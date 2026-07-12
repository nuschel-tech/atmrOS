"""classify() gegen ECHTE osmium.osm.TagList-Objekte testen.

Der Blocker (AttributeError: 'TagList' object has no attribute 'keys') wäre
durch einen dict-basierten Test nicht auffindbar gewesen — dict hat keys(),
TagList nicht. Deshalb bauen wir eine winzige .osm-Datei und rufen classify()
INNERHALB des pyosmium-Callbacks auf, wo der echte TagList-Typ vorliegt
(TagLists dürfen nach Rückkehr aus dem Callback nicht mehr benutzt werden).

Laufbar mit pytest ODER standalone:  python tests/test_classify.py
"""

from __future__ import annotations

import os
import sys
import tempfile

import osmium

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from atmros.config import classify  # noqa: E402

# Jeder Node trägt ein realistisches Tag-Set; erwartetes classify()-Ergebnis
# steht in der description. Der Priority-Fall (id 90) hat man_made=tower UND
# power=substation — nach Regel-Reihenfolge gewinnt substation NICHT, sondern
# man_made... nein: siehe CATEGORY_RULES-Reihenfolge -> substation kommt vor
# power_tower, aber man_made=tower kommt noch davor. Erwartung: "tower".
_NODES = [
    (10, {"man_made": "mast", "operator": "Telekom"}, "mast"),
    (11, {"man_made": "tower", "tower:type": "communication"}, "tower"),
    (12, {"power": "tower"}, "power_tower"),
    (13, {"power": "substation", "substation": "minor_distribution"}, "substation"),
    (14, {"amenity": "charging_station", "capacity": "2"}, "charging_station"),
    (15, {"man_made": "surveillance", "surveillance": "public"}, "surveillance"),
    (16, {"amenity": "fuel", "brand": "Aral"}, "fuel"),
    (80, {"highway": "bus_stop"}, None),
    (81, {"building": "church"}, None),
    (82, {}, None),
    (90, {"man_made": "tower", "power": "substation"}, "tower"),  # Priorität
]


def _build_osm(path: str) -> None:
    lines = ['<?xml version="1.0"?>', '<osm version="0.6">']
    for nid, tags, _ in _NODES:
        lat = 48.0 + nid / 1000.0
        lon = 11.0 + nid / 1000.0
        tagxml = "".join(f'<tag k="{k}" v="{v}"/>' for k, v in tags.items())
        lines.append(f'<node id="{nid}" lat="{lat}" lon="{lon}">{tagxml}</node>')
    lines.append("</osm>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


class _ClassifyProbe(osmium.SimpleHandler):
    """Ruft classify() mit dem echten TagList auf und sammelt (id -> result)."""

    def __init__(self) -> None:
        super().__init__()
        self.results: dict[int, str | None] = {}
        self.taglist_type: str | None = None

    def node(self, n: osmium.osm.Node) -> None:
        if self.taglist_type is None:
            self.taglist_type = type(n.tags).__name__
        # Wichtig: classify HIER aufrufen — echtes TagList, nicht kopiert.
        self.results[n.id] = classify(n.tags)


def _run_probe() -> _ClassifyProbe:
    fd, path = tempfile.mkstemp(suffix=".osm")
    os.close(fd)
    try:
        _build_osm(path)
        probe = _ClassifyProbe()
        probe.apply_file(path)
        return probe
    finally:
        os.unlink(path)


def test_classify_with_real_taglist() -> None:
    probe = _run_probe()
    # Sicherstellen, dass wir wirklich gegen den echten TagList-Typ getestet
    # haben (nicht versehentlich gegen ein dict).
    assert probe.taglist_type == "TagList", probe.taglist_type
    for nid, _tags, expected in _NODES:
        assert probe.results[nid] == expected, (
            f"node {nid}: got {probe.results[nid]!r}, expected {expected!r}"
        )


def test_taglist_has_no_keys_method() -> None:
    """Regressions-Wächter: bestätigt die Ursache des Blockers."""
    fd, path = tempfile.mkstemp(suffix=".osm")
    os.close(fd)
    seen = {}
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write('<?xml version="1.0"?><osm version="0.6">'
                     '<node id="1" lat="48.1" lon="11.1"><tag k="man_made" v="mast"/></node>'
                     '</osm>')

        class _H(osmium.SimpleHandler):
            def node(self, n: osmium.osm.Node) -> None:
                seen["has_keys"] = hasattr(n.tags, "keys")

        _H().apply_file(path)
    finally:
        os.unlink(path)
    assert seen.get("has_keys") is False, "TagList unerwartet mit keys() — Test anpassen"


if __name__ == "__main__":
    test_classify_with_real_taglist()
    test_taglist_has_no_keys_method()
    print("OK — classify() gegen echtes TagList grün (11 Fälle + keys()-Wächter)")
