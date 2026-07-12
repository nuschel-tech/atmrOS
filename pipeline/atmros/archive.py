"""ROHLAGER — Grundregel 3: einmal geschrieben, nie verändert.

Jeder Lauf legt die gefilterten Objekte als komprimiertes GeoParquet ab und
hängt eine Zeile mit SHA-256 an manifest.jsonl (Beweis-Kette). Nur die
gefilterten Objekte, nicht das 806-MB-Vollextrakt.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_archive(records: list[dict], observed_at: datetime,
                  source: str, source_url: str, archive_dir: str) -> dict:
    """Schreibt GeoParquet + Manifest-Zeile. Gibt die Manifest-Zeile zurück.

    Dateiname trägt das Stand-Datum, damit die Kette lesbar ist. Existiert die
    Datei schon (erneuter Lauf desselben Extrakts), wird sie NICHT überschrieben
    — das Rohlager ist unantastbar.
    """
    os.makedirs(archive_dir, exist_ok=True)
    stamp = observed_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    parquet_path = os.path.join(archive_dir, f"osm-geofabrik-bayern-{stamp}.parquet")

    if os.path.exists(parquet_path):
        # Unantastbar: bestehende Datei bleibt, wir referenzieren sie nur.
        sha = _sha256_file(parquet_path)
        return _manifest_entry(parquet_path, sha, len(records), observed_at,
                               source, source_url, note="already-present")

    frame = pd.DataFrame.from_records([
        {
            "osm_type": r["osm_type"],
            "osm_id": r["osm_id"],
            "category": r["category"],
            "attrs": json.dumps(r["attrs"], ensure_ascii=False, sort_keys=True),
        }
        for r in records
    ])
    geometry = [Point(r["lon"], r["lat"]) for r in records]
    gdf = gpd.GeoDataFrame(frame, geometry=geometry, crs="EPSG:4326")
    gdf.to_parquet(parquet_path, compression="zstd", index=False)

    sha = _sha256_file(parquet_path)
    entry = _manifest_entry(parquet_path, sha, len(records), observed_at,
                            source, source_url)
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
