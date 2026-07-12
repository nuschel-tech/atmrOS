# atmrOS Pipeline — Ingest-Job (Schritt 1). Kein Dauerdienst; per
#   docker compose run --rm ingest
# gestartet. Schritt 2 hängt das an einen systemd-Timer auf dem Host.
FROM python:3.12-slim

# geopandas/shapely/pyproj brauchen GEOS/PROJ zur Laufzeit; pyosmium baut gegen
# libexpat/zlib. Slim-Image daher gezielt ergänzen.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libexpat1 zlib1g libgeos-c1v5 libproj25 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY atmros ./atmros

# Rohlager liegt auf einem Volume (siehe docker-compose).
VOLUME ["/data"]
ENTRYPOINT ["python", "-m", "atmros.ingest"]
