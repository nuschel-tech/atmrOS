"""Orchestrierung der Kette, Schritt 1: SAMMELN -> FILTERN -> ROHLAGER -> SPEICHERN.

    python -m atmros.ingest                 # voller Lauf gegen Bayern-PBF
    python -m atmros.ingest --pbf FILE      # lokales PBF statt Download
    python -m atmros.ingest --dry-run       # ohne DB: nur zählen + Sample-GeoJSON

Robustheit (Grundregel 4): Fehler werden geloggt, der Prozess endet mit
Exit-Code != 0, aber es wird nie halb-fertig stillschweigend committet — der
DB-Schritt läuft in EINER Transaktion.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import resource
import sys
import tempfile
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

from . import config
from .osm_handler import parse_pbf

log = logging.getLogger("atmros.ingest")


def _resolve_source(pbf_arg: str | None) -> tuple[str, datetime, str, bool]:
    """Liefert (lokaler_pfad, observed_at, source_url, ist_temp).

    observed_at ist das entscheidende Stand-Datum: bei Download aus dem
    HTTP-Header `last-modified`, bei lokaler Datei die mtime.
    """
    if pbf_arg and os.path.exists(pbf_arg):
        mtime = datetime.fromtimestamp(os.path.getmtime(pbf_arg), tz=timezone.utc)
        return pbf_arg, mtime, config.SOURCE_URL, False

    url = pbf_arg or config.GEOFABRIK_PBF_URL
    log.info("Lade PBF: %s", url)
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()

    last_mod = resp.headers.get("last-modified")
    observed_at = (parsedate_to_datetime(last_mod) if last_mod
                   else datetime.now(timezone.utc))
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)

    fd, tmp_path = tempfile.mkstemp(suffix=".osm.pbf")
    total = 0
    with os.fdopen(fd, "wb") as fh:
        for chunk in resp.iter_content(chunk_size=1 << 20):
            fh.write(chunk)
            total += len(chunk)
    log.info("PBF geladen: %.1f MB, Stand %s", total / 1e6, observed_at.isoformat())
    return tmp_path, observed_at, url, True


def _index_file(spec: str) -> str | None:
    """Datei-Pfad eines datei-gestützten Node-Index (z.B. 'sparse_file_array,/x').
    RAM-Indizes wie 'flex_mem' haben keine Datei -> None."""
    if "," in spec:
        return spec.split(",", 1)[1] or None
    return None


def run(pbf_arg: str | None, dry_run: bool) -> dict:
    engine = None
    pbf_path: str | None = None
    is_temp = False
    idx_file = _index_file(config.OSM_LOCATION_INDEX)
    try:
        # Für echte Läufe früh DB verbinden + Status "running" setzen — so kann
        # das Frontend während Download/Parse "Daten werden aktualisiert" zeigen.
        if not dry_run:
            from . import db
            engine = db.get_engine(config.database_url())
            db.ensure_schema(engine)  # idempotente Migration (subtype/present/state)
            db.set_status(engine, "running")

        # --- SAMMELN ----------------------------------------------------------
        pbf_path, observed_at, source_url, is_temp = _resolve_source(pbf_arg)
        # Stale Node-Index aus einem früheren (evtl. abgebrochenen) Lauf entfernen.
        if idx_file and os.path.exists(idx_file):
            os.unlink(idx_file)

        # --- FILTERN: PBF streamen, Records sammeln ---------------------------
        log.info("Node-Index: %s", config.OSM_LOCATION_INDEX)
        records: list[dict] = []
        handler = parse_pbf(pbf_path, records.append, config.OSM_LOCATION_INDEX)
        log.info("Gefiltert: %d Objekte %s (ohne Geometrie übersprungen: %d)",
                 len(records), dict(sorted(handler.counts.items())),
                 handler.skipped_no_geom)

        if not records:
            raise RuntimeError("Keine Objekte gefiltert — Kette würde leer laufen.")

        for cat in ("substation", "tower", "mast"):
            sub = _subtype_summary(records, cat)
            if sub:
                log.info("Untertypen %s: %s", cat, sub)

        if dry_run:
            sample = records[:50]
            out = os.path.join(tempfile.gettempdir(), "atmros_sample.geojson")
            _write_sample_geojson(sample, out)
            log.info("dry-run: kein DB-Schreiben. Sample (%d) -> %s", len(sample), out)
            return {"objects": len(records), "counts": handler.counts,
                    "sample_geojson": out}

        # --- ROHLAGER: unantastbares Parquet + Hash-Manifest ------------------
        from . import archive  # lazy: pyarrow erst laden, wenn wirklich nötig
        manifest = archive.write_archive(
            records, observed_at, config.SOURCE, source_url, config.ARCHIVE_DIR)
        log.info("Rohlager: %s (sha256=%s…, %d Objekte)",
                 manifest["path"], manifest["sha256"][:12], manifest["count"])

        # --- SPEICHERN + ERINNERN: object/observation/change_event ------------
        summary = db.write_run(engine, records, observed_at,
                               config.SOURCE, source_url)
        log.info("PostGIS: %d Objekte, %d neue Beobachtungen | Diff: "
                 "NEU %d · GEÄNDERT %d · GELÖSCHT %d · WIEDER %d · unverändert %d",
                 summary["objects"], summary["observations_inserted"],
                 summary["new"], summary["changed"], summary["deleted"],
                 summary["restored"], summary["unchanged"])
        summary["counts"] = handler.counts
        summary["observed_at"] = observed_at.isoformat()
        return summary
    finally:
        if is_temp and pbf_path and os.path.exists(pbf_path):
            os.unlink(pbf_path)
        if idx_file and os.path.exists(idx_file):
            os.unlink(idx_file)
        # Status immer zurücksetzen — auch bei Fehler darf "running" nie hängen.
        if engine is not None:
            try:
                from . import db
                db.set_status(engine, "idle")
            except Exception:  # noqa: BLE001
                log.exception("Ingest-Status konnte nicht auf idle gesetzt werden")
        # Peak-RAM des Prozesses (Linux: ru_maxrss in KB). Wichtige Kennzahl,
        # weil der Node-Index den Löwenanteil ausmacht (flex_mem ~2,1 GB für
        # Bayern; sparse_file_array hält ihn auf der Platte, RAM bleibt klein).
        peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
        log.info("Peak-RAM: %.0f MB", peak_mb)


def _subtype_summary(records: list[dict], category: str) -> dict[str, int]:
    """Zählt Untertypen einer Kategorie (None -> '(ohne Angabe)'), absteigend."""
    counts: dict[str, int] = {}
    for r in records:
        if r["category"] != category:
            continue
        key = r.get("subtype") or "(ohne Angabe)"
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


def _write_sample_geojson(records: list[dict], path: str) -> None:
    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
            "properties": {"osm_type": r["osm_type"], "osm_id": r["osm_id"],
                           "category": r["category"], **r["attrs"]},
        }
        for r in records
    ]
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh,
                  ensure_ascii=False, indent=2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="atmrOS Ingest (Schritt 1)")
    parser.add_argument("--pbf", help="Lokales PBF oder URL (Standard: Geofabrik Bayern)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Nur parsen/zählen, keine DB, Sample-GeoJSON schreiben")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        run(args.pbf, args.dry_run)
        return 0
    except Exception:  # noqa: BLE001 — bewusst: loggen und sauber mit !=0 raus
        log.exception("Ingest fehlgeschlagen — Kette abgebrochen, nichts committet.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
