"""SAMMELN, Quelle 2 — PEGELONLINE (WSV): Pegel an Bundeswasserstraßen.

    python -m atmros.pegel              # voller Lauf gegen die REST-API
    python -m atmros.pegel --dry-run    # ohne DB: nur zählen

Warum diese Quelle zuerst (Stufe B): offene REST-API ohne Key, Lizenz
dl-zero-de/2.0 (Quellenvermerk: www.pegelonline.wsv.de), kleine saubere
Datenmenge — der ideale Beweis, dass eine zweite Quelle durch dieselbe
Kette läuft (Rohlager -> observation -> Diff -> Tiles).

Wichtig: In die Beobachtungen gehen NUR Stammdaten der Station (Name,
Gewässer, km, Betreiber …). Der laufende Wasserstand ist eine Messung,
keine Infrastruktur-Änderung — er würde das Änderungs-Archiv mit täglichem
Rauschen fluten. Live-Werte holt die API on demand (/pegel/{id}/current).

Objekt-Identität: osm_type='p', osm_id=Pegelnummer (amtlich, stabil).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone

import requests

from . import config

log = logging.getLogger("atmros.pegel")

PEGEL_API = "https://www.pegelonline.wsv.de/webservices/rest-api/v2"
STATIONS_URL = f"{PEGEL_API}/stations.json"
SOURCE = "wsv/pegelonline"
LICENSE = "dl-zero-de/2.0 — Quelle: www.pegelonline.wsv.de"

# --- Bayern-Filter (kuratiert, real geprüft am 31.07.2026) -------------------
# PEGELONLINE ist bundesweit (~786 Stationen) und kennt kein Bundesland.
# Eine reine BBox fängt Neckar/Bodensee (BW) mit ein — deshalb BBox UND
# kuratierte Gewässerliste. Grenzpegel am bayerischen Ufer sind bewusst
# drin (Achleiten, Wertheim, unterer Main): sie messen bayerisches Wasser.
_BBOX = (8.97, 47.25, 13.85, 50.60)  # lon_min, lat_min, lon_max, lat_max
# Gewässer-Kurzname -> minimale Fluss-km (None = keine Schranke).
# MAIN ab ~km 70: Landesgrenze bei Kahl; flussabwärts davon ist Hessen.
_WATERS: dict[str, float | None] = {
    "DONAU": None,
    "MAIN": 70.0,
    "MDK": None,   # Main-Donau-Kanal, vollständig in Bayern
}


def in_bavaria(station: dict) -> bool:
    """Kuratierter Bayern-Filter: Koordinaten + BBox + Gewässer(+km)."""
    lon = station.get("longitude")
    lat = station.get("latitude")
    if lon is None or lat is None:
        return False  # ohne Koordinaten kein Kartenobjekt
    if not (_BBOX[0] <= lon <= _BBOX[2] and _BBOX[1] <= lat <= _BBOX[3]):
        return False
    water = (station.get("water") or {}).get("shortname", "")
    if water not in _WATERS:
        return False
    min_km = _WATERS[water]
    if min_km is not None and (station.get("km") is None or station["km"] < min_km):
        return False
    return True


def station_record(station: dict) -> dict:
    """Station -> Kette-Record (gleiche Form wie die OSM-Records).

    attrs = flache Stammdaten-Strings; Reihenfolge egal (canonical_attrs
    sortiert). uuid bleibt drin — die API braucht sie für den Live-Wert."""
    water = (station.get("water") or {}).get("shortname", "")
    attrs: dict[str, str] = {
        "name": station.get("longname") or station.get("shortname") or "",
        "gewaesser": water,
        "pegelnummer": station["number"],
        "uuid": station["uuid"],
        "betreiber_wsa": station.get("agency") or "",
        "lizenz": LICENSE,
    }
    if station.get("km") is not None:
        attrs["fluss_km"] = str(station["km"])
    return {
        "osm_type": "p",
        "osm_id": int(station["number"]),
        "category": "pegel",
        # Untertyp = Gewässer (kuratiert: nur die drei aus _WATERS).
        "subtype": water.lower() if water in _WATERS else None,
        "lon": float(station["longitude"]),
        "lat": float(station["latitude"]),
        "attrs": attrs,
    }


def fetch_stations() -> list[dict]:
    resp = requests.get(STATIONS_URL, timeout=60)
    resp.raise_for_status()
    return resp.json()


def run(dry_run: bool) -> dict:
    observed_at = datetime.now(timezone.utc)  # Live-API: Stand = Abrufzeit
    stations = fetch_stations()
    records = [station_record(s) for s in stations if in_bavaria(s)]
    per_water: dict[str, int] = {}
    for r in records:
        key = r["subtype"] or "?"
        per_water[key] = per_water.get(key, 0) + 1
    log.info("PEGELONLINE: %d Stationen bundesweit, %d in Bayern %s",
             len(stations), len(records), dict(sorted(per_water.items())))
    if not records:
        raise RuntimeError("Kein Pegel gefiltert — Kette würde leer laufen.")

    if dry_run:
        log.info("dry-run: kein DB-Schreiben.")
        return {"objects": len(records), "per_water": per_water}

    from . import archive, db
    engine = db.get_engine(config.database_url())
    db.ensure_schema(engine)
    db.set_status(engine, "running")
    try:
        manifest = archive.write_archive(
            records, observed_at, SOURCE, STATIONS_URL, config.ARCHIVE_DIR,
            prefix="wsv-pegelonline-bayern")
        log.info("Rohlager: %s (sha256=%s…, %d Objekte)",
                 manifest["path"], manifest["sha256"][:12], manifest["count"])
        summary = db.write_run(engine, records, observed_at, SOURCE, STATIONS_URL)
        log.info("PostGIS: %d Pegel, %d neue Beobachtungen | Diff: NEU %d · "
                 "GEÄNDERT %d · GELÖSCHT %d · WIEDER %d · unverändert %d",
                 summary["objects"], summary["observations_inserted"],
                 summary["new"], summary["changed"], summary["deleted"],
                 summary["restored"], summary["unchanged"])
        summary["observed_at"] = observed_at.isoformat()
        return summary
    finally:
        # Status immer zurücksetzen — "running" darf nie hängen bleiben.
        try:
            db.set_status(engine, "idle")
        except Exception:  # noqa: BLE001
            log.exception("Ingest-Status konnte nicht auf idle gesetzt werden")


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="atmrOS Pegel-Ingest (PEGELONLINE)")
    parser.add_argument("--dry-run", action="store_true",
                        help="nur filtern + zählen, kein DB-/Archiv-Schreiben")
    args = parser.parse_args()
    try:
        summary = run(args.dry_run)
    except Exception:  # noqa: BLE001 — Grundregel 4: laut scheitern, nie halb
        log.exception("Pegel-Ingest fehlgeschlagen")
        return 1
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
