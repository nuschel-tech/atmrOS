"""SPEICHERN — Records nach PostGIS. SQLAlchemy Core + psycopg v3.

Zwei Schritte pro Lauf, in EINER Transaktion (Grundregel 4: die Kette bricht
nie stillschweigend halb ab):
  1. object upsern (Identität + last_seen + aktuelle Geometrie)
  2. observation NUR einfügen, wenn sich der attr_hash gegenüber der letzten
     Beobachtung desselben Objekts geändert hat (Kern des Zeitstempel-Modells)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

from sqlalchemy import create_engine, text

from .config import canonical_attrs
from sqlalchemy.engine import Engine

_CHUNK = 5000


def get_engine(url: str) -> Engine:
    # future=True: klare Transaktionssemantik. pool_pre_ping gegen tote Verbindungen.
    return create_engine(url, future=True, pool_pre_ping=True)


def ensure_schema(engine: Engine) -> None:
    """Idempotente Migrationen. Init-SQL läuft nur bei leerem Volume; für eine
    bereits befüllte DB holen wir hier fehlende Spalten/Indizes nach."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE object ADD COLUMN IF NOT EXISTS subtype text"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS object_cat_sub_idx ON object (category, subtype)"
        ))


def attr_hash(attrs: dict[str, str]) -> str:
    """Stabiler Hash über die Tags — kanonisches JSON (sortiert, kompakt).
    Serialisierung über config.canonical_attrs (dieselbe wie im Rohlager)."""
    return hashlib.sha256(canonical_attrs(attrs).encode("utf-8")).hexdigest()


def _chunks(seq: list, size: int):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _latest_hashes(conn) -> dict[tuple[str, int], str]:
    """Neuester attr_hash pro Objekt — für die Dedup-Entscheidung."""
    rows = conn.execute(text(
        """
        SELECT DISTINCT ON (osm_type, osm_id) osm_type, osm_id, attr_hash
        FROM observation
        ORDER BY osm_type, osm_id, observed_at DESC, id DESC
        """
    ))
    return {(r.osm_type, r.osm_id): r.attr_hash for r in rows}


def write_run(engine: Engine, records: list[dict], observed_at: datetime,
              source: str, source_url: str) -> dict:
    """Schreibt einen kompletten Ingest-Lauf. Gibt eine Zusammenfassung zurück."""
    summary = {"objects": len(records), "observations_inserted": 0,
               "observations_unchanged": 0}

    with engine.begin() as conn:  # eine Transaktion, all-or-nothing
        # 1) object upsern -----------------------------------------------------
        obj_upsert = text(
            """
            INSERT INTO object
                (osm_type, osm_id, category, subtype, first_seen, last_seen, geom)
            VALUES (:osm_type, :osm_id, :category, :subtype, :ts, :ts,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
            ON CONFLICT (osm_type, osm_id) DO UPDATE
                SET category  = EXCLUDED.category,
                    subtype   = EXCLUDED.subtype,
                    last_seen = GREATEST(object.last_seen, EXCLUDED.last_seen),
                    geom      = EXCLUDED.geom
            """
        )
        for chunk in _chunks(records, _CHUNK):
            conn.execute(obj_upsert, [
                {
                    "osm_type": r["osm_type"], "osm_id": r["osm_id"],
                    "category": r["category"], "subtype": r.get("subtype"),
                    "ts": observed_at, "lon": r["lon"], "lat": r["lat"],
                }
                for r in chunk
            ])

        # 2) observation dedup gegen letzten Hash -----------------------------
        latest = _latest_hashes(conn)
        to_insert: list[dict] = []
        for r in records:
            h = attr_hash(r["attrs"])
            key = (r["osm_type"], r["osm_id"])
            if latest.get(key) == h:
                summary["observations_unchanged"] += 1
                continue
            # Innerhalb desselben Laufs nicht doppelt einfügen (falls ein Objekt
            # mehrfach im PBF auftaucht) — merken wir uns über latest.
            latest[key] = h
            to_insert.append({
                "osm_type": r["osm_type"], "osm_id": r["osm_id"],
                "observed_at": observed_at,
                "attrs": json.dumps(r["attrs"], ensure_ascii=False),
                "attr_hash": h, "source": source, "source_url": source_url,
            })

        obs_insert = text(
            """
            INSERT INTO observation
                (osm_type, osm_id, observed_at, attrs, attr_hash, source, source_url)
            VALUES
                (:osm_type, :osm_id, :observed_at, CAST(:attrs AS jsonb),
                 :attr_hash, :source, :source_url)
            """
        )
        for chunk in _chunks(to_insert, _CHUNK):
            conn.execute(obs_insert, chunk)
        summary["observations_inserted"] = len(to_insert)

    return summary
