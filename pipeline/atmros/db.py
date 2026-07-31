"""SPEICHERN + ERINNERN — Records nach PostGIS. SQLAlchemy Core + psycopg v3.

Alles in EINER Transaktion (Grundregel 4: die Kette bricht nie stillschweigend
halb ab). Ablauf pro Lauf:
  0. Snapshot des letzten Zustands lesen (hash + attrs + present pro Objekt)
  1. object upsern (present=true für alles, was gesehen wurde)
  2. observation NUR bei NEW/CHANGED/RESTORED einfügen
  3. change_event ableiten (NEW/CHANGED/DELETED/RESTORED) — außer beim
     allerersten Lauf (Baseline erzeugt keine Änderungen)
  4. verschwundene Objekte auf present=false setzen (DELETED)
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from .config import canonical_attrs
from .diff import classify, compute_diff

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
            "ALTER TABLE object ADD COLUMN IF NOT EXISTS present boolean NOT NULL DEFAULT true"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS object_cat_sub_idx ON object (category, subtype)"
        ))
        # Ein-Zeilen-Tabelle für den Ingest-Status (Frontend zeigt "aktualisiert").
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS ingest_state (
                id         boolean PRIMARY KEY DEFAULT true CHECK (id),
                status     text    NOT NULL DEFAULT 'idle',
                started_at timestamptz,
                updated_at timestamptz NOT NULL DEFAULT now()
            )
            """
        ))
        conn.execute(text(
            "INSERT INTO ingest_state (id, status) VALUES (true, 'idle') "
            "ON CONFLICT (id) DO NOTHING"
        ))


def set_status(engine: Engine, status: str) -> None:
    """Setzt den Ingest-Status ('running'/'idle'). started_at nur beim Start."""
    with engine.begin() as conn:
        conn.execute(text(
            """
            INSERT INTO ingest_state (id, status, started_at, updated_at)
            VALUES (true, :s,
                    CASE WHEN :s = 'running' THEN now() ELSE NULL END, now())
            ON CONFLICT (id) DO UPDATE
                SET status = EXCLUDED.status,
                    started_at = CASE WHEN EXCLUDED.status = 'running'
                                      THEN now() ELSE ingest_state.started_at END,
                    updated_at = now()
            """
        ), {"s": status})


def last_observed(engine: Engine):
    """Neuester observed_at über alle Beobachtungen (= zuletzt eingelesener
    PBF-Stand). None, wenn noch nie ingested. Für den --if-modified-Check."""
    with engine.connect() as conn:
        row = conn.execute(text("SELECT max(observed_at) AS m FROM observation")).first()
    return row.m if row else None


def attr_hash(attrs: dict[str, str]) -> str:
    """Stabiler Hash über die Tags — kanonisches JSON (sortiert, kompakt).
    Serialisierung über config.canonical_attrs (dieselbe wie im Rohlager)."""
    return hashlib.sha256(canonical_attrs(attrs).encode("utf-8")).hexdigest()


def _chunks(seq: list, size: int):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _latest_state(conn, source: str) -> dict[tuple[str, int], dict]:
    """Letzter bekannter Zustand pro Objekt DIESER QUELLE: hash + attrs (aus
    der neuesten Beobachtung) + present (aus object). Basis für den Diff.

    Das Source-Scoping ist die Grundlage für Mehr-Quellen-Betrieb (Stufe B):
    ein PEGELONLINE-Lauf sieht nur Pegel-Objekte — sonst würde er alle
    OSM-Objekte als DELETED werten, weil sie in seinem `seen` fehlen."""
    obs = conn.execute(text(
        """
        SELECT DISTINCT ON (osm_type, osm_id) osm_type, osm_id, attr_hash, attrs
        FROM observation
        WHERE source = :src
        ORDER BY osm_type, osm_id, observed_at DESC, id DESC
        """
    ), {"src": source})
    state: dict[tuple[str, int], dict] = {}
    for r in obs:
        state[(r.osm_type, r.osm_id)] = {"hash": r.attr_hash, "attrs": r.attrs or {}}
    present = conn.execute(text("SELECT osm_type, osm_id, present FROM object"))
    for r in present:
        key = (r.osm_type, r.osm_id)
        if key in state:
            state[key]["present"] = r.present
    # Objekte ohne Beobachtung sollte es nicht geben; falls doch, present ergänzen.
    for key, s in state.items():
        s.setdefault("present", True)
    return state


def _obs_row(r: dict, h: str, ts: datetime, source: str, source_url: str) -> dict:
    return {
        "osm_type": r["osm_type"], "osm_id": r["osm_id"], "observed_at": ts,
        "attrs": json.dumps(r["attrs"], ensure_ascii=False),
        "attr_hash": h, "source": source, "source_url": source_url,
    }


def _event(osm_type: str, osm_id: int, event_type: str, ts: datetime,
           diff: dict | None) -> dict:
    return {
        "osm_type": osm_type, "osm_id": osm_id, "event_type": event_type,
        "observed_at": ts,
        "diff": json.dumps(diff, ensure_ascii=False) if diff else None,
    }


def write_run(engine: Engine, records: list[dict], observed_at: datetime,
              source: str, source_url: str) -> dict:
    """Schreibt einen kompletten Ingest-Lauf inkl. Diff. Gibt eine
    Zusammenfassung (Zähler je Ereignistyp) zurück."""
    # Records nach Schlüssel; Hash vorab. Bei Dubletten im PBF gewinnt die letzte.
    seen: dict[tuple[str, int], dict] = {}
    for r in records:
        seen[(r["osm_type"], r["osm_id"])] = {"record": r, "hash": attr_hash(r["attrs"])}

    summary = {"objects": len(records), "new": 0, "changed": 0, "restored": 0,
               "deleted": 0, "unchanged": 0, "observations_inserted": 0}

    with engine.begin() as conn:  # eine Transaktion, all-or-nothing
        prev = _latest_state(conn, source)
        first_run = not prev  # erster Lauf DIESER Quelle = Baseline, keine Events
        cls = classify(prev, {k: v["hash"] for k, v in seen.items()})

        # 1) object upsern (present=true) -------------------------------------
        _upsert_objects(conn, records, observed_at)

        # 2) Beobachtungen: NEW, CHANGED, RESTORED (RESTORED wird erzwungen,
        #    auch wenn der Hash zufällig dem Stand vor dem Verschwinden gleicht) -
        obs_rows: list[dict] = []
        for group in ("new", "changed", "restored"):
            for key in cls[group]:
                v = seen[key]
                obs_rows.append(_obs_row(v["record"], v["hash"], observed_at,
                                         source, source_url))
        for chunk in _chunks(obs_rows, _CHUNK):
            conn.execute(_OBS_INSERT, chunk)
        summary["observations_inserted"] = len(obs_rows)

        # 3) change_event ableiten (nicht beim allerersten Lauf = Baseline) ----
        if not first_run:
            events: list[dict] = []
            for key in cls["new"]:
                r = seen[key]["record"]
                events.append(_event(r["osm_type"], r["osm_id"], "NEW", observed_at, None))
            for key in cls["restored"]:
                r = seen[key]["record"]
                events.append(_event(r["osm_type"], r["osm_id"], "RESTORED", observed_at, None))
            for key in cls["changed"]:
                r = seen[key]["record"]
                diff = compute_diff(prev[key]["attrs"], r["attrs"])
                events.append(_event(r["osm_type"], r["osm_id"], "CHANGED", observed_at, diff))
            for (t, i) in cls["deleted"]:
                events.append(_event(t, i, "DELETED", observed_at, None))
            for chunk in _chunks(events, _CHUNK):
                conn.execute(_EVENT_INSERT, chunk)

            # 4) verschwundene Objekte auf present=false ----------------------
            for chunk in _chunks(cls["deleted"], _CHUNK):
                conn.execute(_MARK_DELETED, [{"t": t, "i": i} for (t, i) in chunk])

        for g in ("new", "changed", "restored", "deleted", "unchanged"):
            summary[g] = len(cls[g])

    return summary


def _upsert_objects(conn, records: list[dict], observed_at: datetime) -> None:
    for chunk in _chunks(records, _CHUNK):
        conn.execute(_OBJ_UPSERT, [
            {
                "osm_type": r["osm_type"], "osm_id": r["osm_id"],
                "category": r["category"], "subtype": r.get("subtype"),
                "ts": observed_at, "lon": r["lon"], "lat": r["lat"],
            }
            for r in chunk
        ])


_OBJ_UPSERT = text(
    """
    INSERT INTO object
        (osm_type, osm_id, category, subtype, first_seen, last_seen, geom, present)
    VALUES (:osm_type, :osm_id, :category, :subtype, :ts, :ts,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), true)
    ON CONFLICT (osm_type, osm_id) DO UPDATE
        SET category  = EXCLUDED.category,
            subtype   = EXCLUDED.subtype,
            last_seen = GREATEST(object.last_seen, EXCLUDED.last_seen),
            geom      = EXCLUDED.geom,
            present   = true
    """
)

_OBS_INSERT = text(
    """
    INSERT INTO observation
        (osm_type, osm_id, observed_at, attrs, attr_hash, source, source_url)
    VALUES
        (:osm_type, :osm_id, :observed_at, CAST(:attrs AS jsonb),
         :attr_hash, :source, :source_url)
    """
)

_EVENT_INSERT = text(
    """
    INSERT INTO change_event (osm_type, osm_id, event_type, observed_at, diff)
    VALUES (:osm_type, :osm_id, :event_type, :observed_at, CAST(:diff AS jsonb))
    """
)

_MARK_DELETED = text("UPDATE object SET present = false WHERE osm_type = :t AND osm_id = :i")
