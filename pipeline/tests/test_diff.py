"""Reine Diff-Logik testen (DB-frei): classify() + compute_diff().

Laufbar mit pytest ODER standalone:  python tests/test_diff.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from atmros.diff import classify, compute_diff  # noqa: E402


def _p(hash_: str, present: bool) -> dict:
    return {"hash": hash_, "attrs": {}, "present": present}


def test_classify_all_events() -> None:
    prev = {
        ("n", 1): _p("h1", True),    # unchanged
        ("n", 2): _p("h1", True),    # changed
        ("n", 3): _p("h1", True),    # deleted (nicht mehr gesehen)
        ("n", 4): _p("h1", False),   # restored (war weg)
        ("n", 5): _p("h1", False),   # bleibt weg -> kein Event
    }
    seen = {
        ("n", 1): "h1",              # unchanged
        ("n", 2): "h2",              # changed
        ("n", 4): "h9",              # restored
        ("n", 9): "h1",              # new (nicht in prev)
    }
    out = classify(prev, seen)
    assert out["new"] == [("n", 9)], out["new"]
    assert out["changed"] == [("n", 2)], out["changed"]
    assert out["restored"] == [("n", 4)], out["restored"]
    assert out["unchanged"] == [("n", 1)], out["unchanged"]
    assert sorted(out["deleted"]) == [("n", 3)], out["deleted"]
    # (n,5) war schon weg -> darf NICHT erneut als deleted auftauchen
    assert ("n", 5) not in out["deleted"]


def test_classify_first_run() -> None:
    out = classify({}, {("n", 1): "h1", ("w", 2): "h2"})
    assert sorted(out["new"]) == [("n", 1), ("w", 2)]
    assert out["deleted"] == [] and out["changed"] == [] and out["restored"] == []


def test_compute_diff() -> None:
    assert compute_diff({"a": "1", "b": "2"}, {"a": "1", "b": "3", "c": "4"}) == {
        "changed": {"b": ["2", "3"]}, "added": {"c": "4"},
    }
    assert compute_diff({"a": "1"}, {}) == {"removed": {"a": "1"}}
    assert compute_diff(None, {"a": "1"}) == {"added": {"a": "1"}}
    assert compute_diff({"a": "1"}, {"a": "1"}) == {}


if __name__ == "__main__":
    test_classify_all_events()
    test_classify_first_run()
    test_compute_diff()
    print("OK — Diff-Logik grün (classify: NEW/CHANGED/DELETED/RESTORED/unchanged; compute_diff)")
