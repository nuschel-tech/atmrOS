"""FILTERN — pyosmium-Handler, der das PBF streamt und relevante Objekte
als vollständig materialisierte Records ausgibt.

Wichtig (pyosmium-Fallstrick): Tags und Locations dürfen NICHT nach Rückkehr
aus dem Callback gelesen werden — der Puffer wird wiederverwendet. Deshalb
bauen wir das Record-Dict komplett im Callback und geben es sofort an den
Sink weiter.
"""

from __future__ import annotations

from typing import Callable

import osmium

from .config import classify

# Ein Record ist ein einfaches Dict — bewusst kein ORM-Objekt, damit die
# Parse-Stufe DB-frei und für sich testbar bleibt.
Record = dict
Sink = Callable[[Record], None]


def _tags_to_dict(tags: osmium.osm.TagList) -> dict[str, str]:
    return {t.k: t.v for t in tags}


class InfraHandler(osmium.SimpleHandler):
    """Extrahiert Infrastruktur-Objekte. Nodes -> Punkt direkt; Ways -> auf
    einen Repräsentativpunkt (Mittel der gültigen Knoten) reduziert."""

    def __init__(self, sink: Sink) -> None:
        super().__init__()
        self._sink = sink
        self.counts: dict[str, int] = {}
        self.skipped_no_geom = 0

    def _emit(self, osm_type: str, osm_id: int, category: str,
              lon: float, lat: float, tags: osmium.osm.TagList) -> None:
        self._sink({
            "osm_type": osm_type,
            "osm_id": osm_id,
            "category": category,
            "lon": lon,
            "lat": lat,
            "attrs": _tags_to_dict(tags),
        })
        self.counts[category] = self.counts.get(category, 0) + 1

    def node(self, n: osmium.osm.Node) -> None:
        category = classify(n.tags)
        if category is None:
            return
        if not n.location.valid():
            self.skipped_no_geom += 1
            return
        self._emit("n", n.id, category, n.location.lon, n.location.lat, n.tags)

    def way(self, w: osmium.osm.Way) -> None:
        category = classify(w.tags)
        if category is None:
            return
        # Repräsentativpunkt: Mittel der gültigen Knotenkoordinaten. Für
        # Marker-Darstellung ausreichend; echte Zentroid-Geometrie wäre
        # Overkill für einen Punkt auf der Karte.
        xs: list[float] = []
        ys: list[float] = []
        for node_ref in w.nodes:
            if node_ref.location.valid():
                xs.append(node_ref.location.lon)
                ys.append(node_ref.location.lat)
        if not xs:
            self.skipped_no_geom += 1
            return
        self._emit("w", w.id, category, sum(xs) / len(xs), sum(ys) / len(ys), w.tags)

    # Relationen (selten für unsere Kategorien) bleiben Schritt 1 außen vor.


def parse_pbf(path: str, sink: Sink, index: str) -> InfraHandler:
    """Streamt das PBF durch den Handler. `locations=True` + Index liefern die
    Knotenkoordinaten für Way-Geometrie. Gibt den Handler mit den Zählern zurück."""
    handler = InfraHandler(sink)
    handler.apply_file(path, locations=True, idx=index)
    return handler
