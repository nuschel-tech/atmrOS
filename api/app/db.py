"""DB-Zugriff der API. Ein Engine-Singleton, sync (FastAPI führt `def`-Endpunkte
im Threadpool aus — reicht für Step 1 sauber und ohne async-Ballast)."""

from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url
    host = os.environ.get("POSTGRES_HOST", "db")
    port = os.environ.get("POSTGRES_PORT", "5432")
    user = os.environ.get("POSTGRES_USER", "atmros")
    password = os.environ.get("POSTGRES_PASSWORD", "atmros")
    name = os.environ.get("POSTGRES_DB", "atmros")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(_database_url(), future=True, pool_pre_ping=True,
                         pool_size=5, max_overflow=5)
