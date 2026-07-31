"""Bayern-Filter + Record-Bau des Pegel-Ingests (DB-frei).

Fixtures = echte Stationen aus der PEGELONLINE-API (Stand 31.07.2026),
inkl. der Grenz-/Ausschlussfälle, die den Filter begründen.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from atmros.pegel import in_bavaria, station_record  # noqa: E402

WUERZBURG = {
    "uuid": "915d76e1-3bf9-4e37-9a9a-4d144cd771cc", "number": "24300600",
    "shortname": "WÜRZBURG", "longname": "WÜRZBURG", "km": 251.97,
    "agency": "SCHWEINFURT", "longitude": 9.925969, "latitude": 49.796209,
    "water": {"shortname": "MAIN", "longname": "MAIN"},
}
NECKAR_BW = {  # in der Bayern-BBox, aber falsches Gewässer -> raus
    "uuid": "x", "number": "1", "shortname": "ROCKENAU SKA", "km": 60.0,
    "agency": "HEIDELBERG", "longitude": 9.0, "latitude": 49.4,
    "water": {"shortname": "NECKAR", "longname": "NECKAR"},
}
MAIN_HESSEN = {  # MAIN, aber km < 70 (Hanau, vor der Landesgrenze) -> raus
    "uuid": "x", "number": "2", "shortname": "HANAU BRÜCKE DFH", "km": 56.398,
    "agency": "ASCHAFFENBURG", "longitude": 8.918, "latitude": 50.120,
    "water": {"shortname": "MAIN", "longname": "MAIN"},
}
CELLE = {  # außerhalb der BBox -> raus
    "uuid": "x", "number": "3", "shortname": "CELLE", "km": 1.74,
    "agency": "VERDEN", "longitude": 10.062164, "latitude": 52.622706,
    "water": {"shortname": "ALLER", "longname": "ALLER"},
}
OHNE_KOORD = {  # keine Koordinaten -> kein Kartenobjekt
    "uuid": "x", "number": "4", "shortname": "IRGENDWO",
    "agency": "X", "water": {"shortname": "DONAU", "longname": "DONAU"},
}
MDK_BAMBERG = {
    "uuid": "y", "number": "24022000", "shortname": "BAMBERG", "km": 7.31,
    "agency": "SCHWEINFURT", "longitude": 10.907, "latitude": 49.882,
    "water": {"shortname": "MDK", "longname": "MAIN-DONAU-KANAL"},
}


def test_bavaria_filter() -> None:
    assert in_bavaria(WUERZBURG)
    assert in_bavaria(MDK_BAMBERG)
    assert not in_bavaria(NECKAR_BW)
    assert not in_bavaria(MAIN_HESSEN)
    assert not in_bavaria(CELLE)
    assert not in_bavaria(OHNE_KOORD)


def test_station_record() -> None:
    r = station_record(WUERZBURG)
    assert r["osm_type"] == "p"
    assert r["osm_id"] == 24300600          # Pegelnummer = stabile Identität
    assert r["category"] == "pegel"
    assert r["subtype"] == "main"           # Untertyp = Gewässer (kuratiert)
    assert r["lon"] == WUERZBURG["longitude"]
    a = r["attrs"]
    assert a["name"] == "WÜRZBURG" and a["gewaesser"] == "MAIN"
    assert a["uuid"] == WUERZBURG["uuid"]   # für den Live-Wert-Proxy
    assert a["fluss_km"] == "251.97"
    assert "lizenz" in a                    # Quelle trägt ihre Lizenz


if __name__ == "__main__":
    test_bavaria_filter()
    test_station_record()
    print("OK — Pegel: Bayern-Filter (BBox+Gewässer+km) und Record-Bau grün")
