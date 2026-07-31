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
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import get_engine
from .session import verify_session
from .version import __version__

app = FastAPI(title="atmrOS API", version=__version__)

# Alle Endpunkte laufen unter diesem Pfad-Präfix. Für Single-Origin-Deployment
# (alles unter atomar.org) auf "/api" setzen; der Reverse-Proxy leitet
# atomar.org/api -> Container weiter, ohne den Pfad zu strippen. Leer = Root.
_ROOT_PATH = os.environ.get("ATMROS_API_ROOT_PATH", "").rstrip("/")
router = APIRouter()

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
        WHERE o.present AND o.geom && bounds.b4326
    )
    SELECT ST_AsMVT(mvt.*, 'infra', 4096, 'geom') AS tile
    FROM mvt
    WHERE geom IS NOT NULL
    """
)


@router.get("/health")
def health() -> dict:
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "version": __version__}


@router.get("/status")
def ingest_status() -> dict:
    """Ob gerade ein Ingest läuft — fürs "Daten werden aktualisiert" im Frontend.
    Offen (kein Gate), defensiv (Tabelle fehlt evtl. vor dem ersten neuen Ingest)."""
    try:
        with get_engine().connect() as conn:
            row = conn.execute(text(
                "SELECT status, updated_at FROM ingest_state WHERE id LIMIT 1"
            )).first()
    except Exception:  # noqa: BLE001 — Tabelle noch nicht migriert -> idle
        return {"status": "idle"}
    if row is None:
        return {"status": "idle"}
    return {"status": row.status,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None}


@router.get("/tiles/{z}/{x}/{y}.pbf", dependencies=[Depends(require_session)])
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


@router.get("/object/{osm_type}/{osm_id}", dependencies=[Depends(require_session)])
def object_detail(osm_type: str, osm_id: int) -> dict:
    # 'p' = Pegel (PEGELONLINE) — Nicht-OSM-Quellen laufen durch dasselbe
    # Objektmodell, nur mit eigenem Typ-Diskriminator.
    if osm_type not in ("n", "w", "r", "p"):
        raise HTTPException(400, "osm_type must be n, w, r or p")

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
_REFINED = ("substation", "tower", "mast", "generator", "street_cabinet", "water",
            "pegel")


@router.get("/stats", dependencies=[Depends(require_session)])
def stats() -> dict:
    with get_engine().connect() as conn:
        by_cat = conn.execute(text(
            "SELECT category, count(*) AS n FROM object WHERE present "
            "GROUP BY category ORDER BY n DESC"
        )).all()
        by_sub = conn.execute(text(
            """
            SELECT category, subtype, count(*) AS n
            FROM object
            WHERE present AND category = ANY(:cats) AND subtype IS NOT NULL
            GROUP BY category, subtype
            ORDER BY n DESC
            """
        ), {"cats": list(_REFINED)}).all()
        latest = conn.execute(text(
            "SELECT max(observed_at) AS m FROM observation"
        )).first()
        per_source = conn.execute(text(
            "SELECT source, max(observed_at) AS m FROM observation GROUP BY source"
        )).all()

    # Nur benannte, kuratierte Untertypen (Ingest normalisiert; NULL = kein
    # kuratierter Wert und wird bewusst nicht als Pseudo-Zeile ausgewiesen —
    # die Kachel-Summe by_category bleibt die ehrliche Gesamtzahl).
    by_subtype: dict[str, dict[str, int]] = {}
    for r in by_sub:
        by_subtype.setdefault(r.category, {})[r.subtype] = r.n

    return {
        "total": sum(r.n for r in by_cat),
        "by_category": {r.category: r.n for r in by_cat},
        "by_subtype": by_subtype,
        "latest_observed_at": latest.m.isoformat() if latest and latest.m else None,
        # Stand je Quelle — die Quellen-Kacheln der Legende zeigen ihn an.
        "by_source": {r.source: r.m.isoformat() for r in per_source if r.m},
    }


@router.get("/changes", dependencies=[Depends(require_session)])
def changes(since: str | None = None, limit: int = 500) -> dict:
    """Änderungen (change_event) seit `since` (ISO 8601, Default: letzte 7 Tage),
    verknüpft mit Objekt-Position/Kategorie. Neueste zuerst."""
    limit = max(1, min(limit, 2000))
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(400, "since must be ISO 8601")
        if since_dt.tzinfo is None:
            since_dt = since_dt.replace(tzinfo=timezone.utc)
    else:
        since_dt = datetime.now(timezone.utc) - timedelta(days=7)

    with get_engine().connect() as conn:
        rows = conn.execute(text(
            """
            SELECT ce.osm_type, ce.osm_id, ce.event_type, ce.observed_at, ce.diff,
                   o.category, o.subtype, ST_Y(o.geom) AS lat, ST_X(o.geom) AS lon
            FROM change_event ce
            JOIN object o ON o.osm_type = ce.osm_type AND o.osm_id = ce.osm_id
            WHERE ce.observed_at >= :since
            ORDER BY ce.observed_at DESC, ce.id DESC
            LIMIT :limit
            """
        ), {"since": since_dt, "limit": limit}).all()

    return {
        "since": since_dt.isoformat(),
        "count": len(rows),
        "changes": [
            {
                "osm_type": r.osm_type, "osm_id": r.osm_id,
                "event_type": r.event_type,
                "observed_at": r.observed_at.isoformat(),
                "category": r.category, "subtype": r.subtype,
                "lon": r.lon, "lat": r.lat, "diff": r.diff,
            }
            for r in rows
        ],
    }


_OSM_TYPE_LONG = {"n": "node", "w": "way", "r": "relation"}


def _osm_url(osm_type: str, osm_id: int) -> str:
    """Deep-Link zur Nachprüfbarkeit — je Quelle das passende Original."""
    if osm_type == "p":
        return f"https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr={osm_id}"
    return f"https://www.openstreetmap.org/{_OSM_TYPE_LONG[osm_type]}/{osm_id}"


# --- Live-Wasserstand (PEGELONLINE) ------------------------------------------
# Bewusst ein Server-Proxy statt Client-Fetch: keine Nutzer-IPs an Dritte
# (DSGVO-Linie des Projekts) + ein kleiner Cache schont die WSV-API.
_PEGEL_API = "https://www.pegelonline.wsv.de/webservices/rest-api/v2"
_PEGEL_CACHE_S = 300
_pegel_cache: dict[int, tuple[float, dict]] = {}


@router.get("/pegel/{osm_id}/current", dependencies=[Depends(require_session)])
def pegel_current(osm_id: int) -> dict:
    """Aktueller Wasserstand (W) eines Pegels — live von PEGELONLINE, nicht
    aus der DB: Messwerte sind keine Beobachtungen im Sinne des Archivs."""
    import time

    import requests

    now = time.monotonic()
    hit = _pegel_cache.get(osm_id)
    if hit and now - hit[0] < _PEGEL_CACHE_S:
        return hit[1]

    with get_engine().connect() as conn:
        row = conn.execute(text(
            """
            SELECT attrs->>'uuid' AS uuid FROM observation
            WHERE osm_type = 'p' AND osm_id = :i
            ORDER BY observed_at DESC, id DESC LIMIT 1
            """
        ), {"i": osm_id}).first()
    if row is None or not row.uuid:
        raise HTTPException(404, "pegel not found")

    try:
        resp = requests.get(
            f"{_PEGEL_API}/stations/{row.uuid}/W/currentmeasurement.json",
            timeout=10)
        resp.raise_for_status()
        m = resp.json()
    except requests.RequestException:
        raise HTTPException(502, "pegelonline unreachable")

    out = {
        "value_cm": m.get("value"),
        "timestamp": m.get("timestamp"),
        "state": m.get("stateMnwMhw"),  # low/normal/high — Einordnung der WSV
        "source": "wsv/pegelonline",
        "source_url": f"{_PEGEL_API}/stations/{row.uuid}/W/currentmeasurement.json",
        "license": "dl-zero-de/2.0 — www.pegelonline.wsv.de",
    }
    _pegel_cache[osm_id] = (now, out)
    return out


# Routen unter dem Präfix einhängen (leer = Root, "/api" = Single-Origin).
app.include_router(router, prefix=_ROOT_PATH)
