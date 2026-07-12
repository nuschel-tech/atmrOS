"""atmrOS API (FastAPI) — Schritt 1.

Endpunkte:
  GET /tiles/{z}/{x}/{y}.pbf   Mapbox Vector Tile via ST_AsMVT
  GET /object/{osm_type}/{osm_id}   Panel-Daten inkl. Historie + Quelle
  GET /stats                   Counts pro Kategorie (VERDICHTEN)
  GET /health

Die Kern-Signatur von atmrOS steckt in /object: jede Antwort trägt source +
source_url + observed_at. Das Panel im Frontend zeigt sie prominent.
"""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import get_engine
from .session import verify_session

app = FastAPI(title="atmrOS API", version="0.1.0")

# Frontend läuft in der Regel auf anderer (aber same-site) Origin. Mit Cookies
# braucht CORS explizite Origins + allow_credentials (kein "*" mit Credentials).
_origins = os.environ.get("ATMROS_CORS_ORIGINS", "http://localhost:4321").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_SESSION_COOKIE = "atmros_session"


def require_session(request: Request) -> None:
    """Gate — dasselbe Cookie wie das Web-Frontend. Nach dem Launch
    (ATMROS_LAUNCHED=true) deaktiviert. /health bleibt ungeschützt, damit
    Healthchecks immer durchkommen."""
    if os.environ.get("ATMROS_LAUNCHED") == "true":
        return
    secret = os.environ.get("ATMROS_SESSION_SECRET", "")
    if not verify_session(secret, request.cookies.get(_SESSION_COOKIE)):
        raise HTTPException(status_code=401, detail="locked")

_MVT_SQL = text(
    """
    WITH bounds AS (
        SELECT ST_TileEnvelope(:z, :x, :y) AS b3857,
               ST_Transform(ST_TileEnvelope(:z, :x, :y), 4326) AS b4326
    ),
    mvt AS (
        SELECT
            ST_AsMVTGeom(ST_Transform(o.geom, 3857), bounds.b3857,
                         extent => 4096, buffer => 64) AS geom,
            o.osm_type,
            o.osm_id,
            o.category,
            o.subtype
        FROM object o, bounds
        WHERE o.geom && bounds.b4326
    )
    SELECT ST_AsMVT(mvt.*, 'infra', 4096, 'geom') AS tile
    FROM mvt
    WHERE geom IS NOT NULL
    """
)


@app.get("/health")
def health() -> dict:
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/tiles/{z}/{x}/{y}.pbf", dependencies=[Depends(require_session)])
def tiles(z: int, x: int, y: int) -> Response:
    if not (0 <= z <= 24):
        raise HTTPException(400, "z out of range")
    limit = 1 << z  # 2^z Kacheln pro Achse
    if not (0 <= x < limit and 0 <= y < limit):
        raise HTTPException(400, "x/y out of range for zoom")

    with get_engine().connect() as conn:
        row = conn.execute(_MVT_SQL, {"z": z, "x": x, "y": y}).first()
    tile = row.tile if row and row.tile is not None else b""

    return Response(
        content=bytes(tile),
        media_type="application/vnd.mapbox-vector-tile",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/object/{osm_type}/{osm_id}", dependencies=[Depends(require_session)])
def object_detail(osm_type: str, osm_id: int) -> dict:
    if osm_type not in ("n", "w", "r"):
        raise HTTPException(400, "osm_type must be n, w or r")

    engine = get_engine()
    with engine.connect() as conn:
        obj = conn.execute(text(
            """
            SELECT osm_type, osm_id, category, subtype, first_seen, last_seen,
                   ST_Y(geom) AS lat, ST_X(geom) AS lon
            FROM object WHERE osm_type = :t AND osm_id = :i
            """
        ), {"t": osm_type, "i": osm_id}).first()
        if obj is None:
            raise HTTPException(404, "object not found")

        history = conn.execute(text(
            """
            SELECT observed_at, attrs, attr_hash, source, source_url
            FROM observation
            WHERE osm_type = :t AND osm_id = :i
            ORDER BY observed_at DESC, id DESC
            """
        ), {"t": osm_type, "i": osm_id}).all()

    current = history[0] if history else None
    return {
        "osm_type": obj.osm_type,
        "osm_id": obj.osm_id,
        "category": obj.category,
        "subtype": obj.subtype,
        "first_seen": obj.first_seen.isoformat(),
        "last_seen": obj.last_seen.isoformat(),
        "lon": obj.lon,
        "lat": obj.lat,
        # OSM-Deep-Link zur Nachprüfbarkeit der Quelle.
        "osm_url": _osm_url(obj.osm_type, obj.osm_id),
        "current": None if current is None else {
            "observed_at": current.observed_at.isoformat(),
            "source": current.source,
            "source_url": current.source_url,
            "attrs": current.attrs,
        },
        "history": [
            {"observed_at": h.observed_at.isoformat(),
             "attr_hash": h.attr_hash, "source": h.source}
            for h in history
        ],
    }


# Kategorien mit Untertyp-Verfeinerung (zu grob ohne subtype).
_REFINED = ("substation", "tower", "mast")


@app.get("/stats", dependencies=[Depends(require_session)])
def stats() -> dict:
    with get_engine().connect() as conn:
        by_cat = conn.execute(text(
            "SELECT category, count(*) AS n FROM object GROUP BY category ORDER BY n DESC"
        )).all()
        by_sub = conn.execute(text(
            """
            SELECT category, subtype, count(*) AS n
            FROM object
            WHERE category = ANY(:cats)
            GROUP BY category, subtype
            ORDER BY n DESC
            """
        ), {"cats": list(_REFINED)}).all()
        latest = conn.execute(text(
            "SELECT max(observed_at) AS m FROM observation"
        )).first()

    by_subtype: dict[str, dict[str, int]] = {}
    for r in by_sub:
        # NULL -> "(ohne Angabe)": ehrlich sichtbar, nicht verschluckt.
        key = r.subtype if r.subtype is not None else "(ohne Angabe)"
        by_subtype.setdefault(r.category, {})[key] = r.n

    return {
        "total": sum(r.n for r in by_cat),
        "by_category": {r.category: r.n for r in by_cat},
        "by_subtype": by_subtype,
        "latest_observed_at": latest.m.isoformat() if latest and latest.m else None,
    }


_OSM_TYPE_LONG = {"n": "node", "w": "way", "r": "relation"}


def _osm_url(osm_type: str, osm_id: int) -> str:
    return f"https://www.openstreetmap.org/{_OSM_TYPE_LONG[osm_type]}/{osm_id}"
