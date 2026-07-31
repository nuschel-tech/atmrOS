"""Zentrale Konfiguration der Pipeline: Quelle, Objekttypen, DB-Verbindung.

Ein Ort für die Wahrheit über 'was ist relevant' und 'woher kommt es'. Wird
sowohl vom Ingest als auch (konzeptionell) von der API geteilt.
"""

from __future__ import annotations

import json
import os


def canonical_attrs(attrs: dict) -> str:
    """Kanonisches JSON der Tags — DIE eine Quelle der Wahrheit für die
    Serialisierung. Sowohl der attr_hash (db.attr_hash) als auch das Rohlager
    (archive) serialisieren hierüber, damit Archiv und DB bitgleich und direkt
    gegeneinander prüfbar sind. Reihenfolge/Trennzeichen NICHT ändern."""
    return json.dumps(attrs, sort_keys=True, ensure_ascii=False, separators=(",", ":"))

# --- Hauptquelle: Geofabrik Bayern-Extrakt (verifiziert, täglich frisch) -----
GEOFABRIK_PBF_URL = os.environ.get(
    "ATMROS_PBF_URL",
    "https://download.geofabrik.de/europe/germany/bayern-latest.osm.pbf",
)

# Herkunfts-Signatur, landet in jeder observation-Zeile.
SOURCE = "osm/geofabrik"
SOURCE_URL = GEOFABRIK_PBF_URL
LICENSE = "ODbL — © OpenStreetMap-Mitwirkende"

# --- Filter: (OSM-Key, OSM-Value) -> atmrOS-Kategorie ------------------------
# Reihenfolge = Priorität; erste Übereinstimmung gewinnt. So bleibt die
# Klassifikation deterministisch, auch wenn ein Objekt mehrere Tags trägt.
# Funktion schlägt Bauform: power=* vor man_made=mast/tower, damit z.B. eine
# Turmstation (man_made=tower + power=substation) als Stromstation zählt.
CATEGORY_RULES: list[tuple[tuple[str, str], str]] = [
    (("man_made", "surveillance"),      "surveillance"),      # Überwachungskameras
    (("power",    "substation"),        "substation"),        # Umspannwerke
    (("power",    "tower"),             "power_tower"),       # Strommasten
    (("man_made", "mast"),              "mast"),              # Sendemasten
    (("man_made", "tower"),             "tower"),             # Türme
    (("amenity",  "charging_station"),  "charging_station"),  # Ladesäulen
    (("amenity",  "fuel"),              "fuel"),              # Tankstellen
]

# Alle Kategorien (Reihenfolge = Anzeige-/Legenden-Reihenfolge).
CATEGORIES: list[str] = [cat for _, cat in CATEGORY_RULES]

# Schneller Vor-Filter: welche Keys müssen wir überhaupt anschauen? Spart bei
# der Masse an OSM-Elementen jede Menge Vergleiche.
_RELEVANT_KEYS = {key for (key, _), _ in CATEGORY_RULES}


def classify(tags) -> str | None:
    """Ordnet ein OSM-Tag-Set einer atmrOS-Kategorie zu, sonst None.

    `tags` ist ein osmium.osm.TagList (kein dict!). Die 4.x-API bietet nur
    get(), __contains__ und __len__ — deshalb Membership via `key in tags`
    statt .keys()/.isdisjoint(). Funktioniert auch mit einem echten dict.
    """
    if not len(tags):
        return None
    # Billiger Ausschluss zuerst — nutzt __contains__ und schließt kurz.
    if not any(key in tags for key in _RELEVANT_KEYS):
        return None
    for (key, value), category in CATEGORY_RULES:
        if tags.get(key) == value:
            return category
    return None


# --- Untertypen: kuratierte Taxonomie statt 1:1-Rohwerte ---------------------
# OSM-Untertyp-Tags sind Wildwuchs: Schreibvarianten (watchtower/watch_tower),
# Nicht-Werte ("yes"), Tippfehler und Nicht-Infrastruktur (Sprung-/Kletterturm).
# Deshalb: Roh-Wert -> kanonischer atmrOS-Untertyp, alles Unbekannte -> None.
# Kuratiert wird NUR die subtype-Spalte (Filter/Zähler); die Roh-Tags bleiben
# vollständig in attrs und im Rohlager (Grundregeln 2+3 — die Quelle lügt nicht).
SUBTYPE_MAP: dict[str, dict[str, str]] = {
    # power=substation -> substation=*
    "substation": {
        "minor_distribution": "minor_distribution",
        "transformer":        "minor_distribution",  # gleiche Funktion,
        "transformer_tower":  "minor_distribution",  # andere Bauform
        "kiosk":              "minor_distribution",
        "distribution":       "distribution",
        "transmission":       "transmission",
        "generation":         "generation",
        "industrial":         "industrial",
        "traction":           "traction",
        "converter":          "converter",
    },
    # man_made=tower -> tower:type=*
    "tower": {
        "bell_tower":         "bell_tower",
        "campanile":          "bell_tower",
        "communication":      "communication",
        "telecommunication":  "communication",
        "radio":              "communication",
        "radar":              "communication",
        "antenna":            "communication",
        "defensive":          "defensive",
        "watchtower":         "defensive",
        "watch_tower":        "defensive",
        "observation":        "observation",
        "lighting":           "lighting",
        "cooling":            "cooling",
        "water":              "water",
    },
    # man_made=mast -> tower:type=*
    "mast": {
        "communication":      "communication",
        "telecommunication":  "communication",
        "radio":              "communication",
        "antenna":            "communication",
        "lighting":           "lighting",
        "siren":              "siren",
        "monitoring":         "monitoring",
    },
}


def normalize_subtype(category: str, raw: str | None) -> str | None:
    """Roh-Untertyp -> kanonischer Untertyp oder None. Case-insensitiv und
    getrimmt, damit Groß-/Leerzeichen-Varianten nicht zählerspaltend wirken."""
    if not raw:
        return None
    return SUBTYPE_MAP.get(category, {}).get(raw.strip().lower())


# --- Datenbank ---------------------------------------------------------------
def database_url() -> str:
    """SQLAlchemy-DSN (psycopg v3). Bevorzugt DATABASE_URL, sonst Einzelteile."""
    url = os.environ.get("DATABASE_URL")
    if url:
        # SQLAlchemy braucht den Treiber-Präfix; 'postgres://' -> psycopg v3.
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


# --- Rohlager ----------------------------------------------------------------
ARCHIVE_DIR = os.environ.get("ATMROS_ARCHIVE_DIR", "/data/archive")

# osmium Node-Location-Index für Way-Geometrie. 'flex_mem' hält die
# Knotenkoordinaten im RAM (für Bayern einige GB). Bei knappem RAM auf einen
# disk-gestützten Index umstellen (z.B. 'sparse_file_array,/data/node.idx').
OSM_LOCATION_INDEX = os.environ.get("ATMROS_OSM_INDEX", "flex_mem")
