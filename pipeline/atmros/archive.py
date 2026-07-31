"""ROHLAGER — Grundregel 3: einmal geschrieben, nie verändert.

Jeder Lauf legt die gefilterten Objekte als komprimiertes Parquet ab und hängt
eine Zeile mit SHA-256 an manifest.jsonl (Beweis-Kette). Nur die gefilterten
Objekte, nicht das ~806-MB-Vollextrakt.

Bewusst NUR pyarrow — keine geopandas/GDAL/PROJ/Fiona-Kette: unsere Objekte sind
lon/lat-Punkte, für die zwei float64-Spalten genügen. Ein explizit
festgeschriebenes pa.schema() hält die Archivdatei über Jahre stabil lesbar.
attrs werden über config.canonical_attrs serialisiert — bitgleich zu dem, worüber
db.attr_hash gebildet wird, damit Archiv und DB direkt gegeneinander prüfbar sind.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

import pyarrow as pa
import pyarrow.parquet as pq

from .config import canonical_attrs

# Explizit eingefrorenes Schema. Reihenfolge/Typen NICHT ändern — sonst wird die
# Beweis-Kette über die Zeit inkonsistent.
_SCHEMA = pa.schema([
    ("osm_type", pa.string()),
    ("osm_id", pa.int64()),
    ("category", pa.string()),
    ("subtype", pa.string()),   # nullable
    ("lon", pa.float64()),
    ("lat", pa.float64()),
    ("attrs", pa.string()),     # kanonisches JSON, s.o.
])


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_archive(records: list[dict], observed_at: datetime,
                  source: str, source_url: str, archive_dir: str,
                  prefix: str = "osm-geofabrik-bayern") -> dict:
    """Schreibt Parquet + Manifest-Zeile. Gibt die Manifest-Zeile zurück.

    Dateiname trägt Quelle (prefix) + Stand-Datum. Existiert die Datei schon
    (erneuter Lauf desselben Extrakts), wird sie NICHT überschrieben — das
    Rohlager ist unantastbar. Geschrieben wird erst nach *.part, dann
    os.replace() — ein abgebrochener Lauf hinterlässt nie eine halbe Datei.
    """
    os.makedirs(archive_dir, exist_ok=True)
    stamp = observed_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(archive_dir, f"{prefix}-{stamp}.parquet")

    if os.path.exists(path):
        sha = _sha256_file(path)
        return _manifest_entry(path, sha, len(records), observed_at,
                               source, source_url, note="already-present")

    table = pa.table(
        {
            "osm_type": [r["osm_type"] for r in records],
            "osm_id": [r["osm_id"] for r in records],
            "category": [r["category"] for r in records],
            "subtype": [r.get("subtype") for r in records],
            "lon": [float(r["lon"]) for r in records],
            "lat": [float(r["lat"]) for r in records],
            "attrs": [canonical_attrs(r["attrs"]) for r in records],
        },
        schema=_SCHEMA,
    )

    part = path + ".part"
    pq.write_table(table, part, compression="zstd")
    os.replace(part, path)  # atomar: entweder ganze Datei oder keine

    sha = _sha256_file(path)
    entry = _manifest_entry(path, sha, len(records), observed_at, source, source_url)
    manifest_path = os.path.join(archive_dir, "manifest.jsonl")
    with open(manifest_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def _manifest_entry(path: str, sha: str, count: int, observed_at: datetime,
                    source: str, source_url: str, note: str | None = None) -> dict:
    entry = {
        "path": os.path.basename(path),
        "sha256": sha,
        "count": count,
        "observed_at": observed_at.astimezone(timezone.utc).isoformat(),
        "written_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "source_url": source_url,
    }
    if note:
        entry["note"] = note
    return entry
