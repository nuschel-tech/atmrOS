"""ERINNERN — die reine Diff-Logik (DB-frei, damit testbar).

Vergleicht den aktuellen Scan gegen den letzten bekannten Zustand und leitet die
vier Ereignistypen ab: NEW / CHANGED / DELETED / RESTORED. Das ist das
Gedächtnis von atmrOS.

Zustandsmodell pro Objekt (aus der DB):
  present  = war das Objekt im letzten Scan sichtbar?
  hash     = attr_hash der letzten Beobachtung
Ein Objekt, das verschwindet, wird nicht gelöscht — nur present=false. Kommt es
zurück, ist das ein RESTORED (kein NEW), weil es schon eine Historie hat.
"""

from __future__ import annotations


def classify(prev: dict, seen_hashes: dict) -> dict:
    """Ordnet jeden Schlüssel einem Ereignis zu.

    prev:        {(osm_type, osm_id): {"hash": str, "present": bool, ...}}
    seen_hashes: {(osm_type, osm_id): attr_hash}  (Objekte im aktuellen Scan)

    Rückgabe: dict mit Listen von Schlüsseln je Kategorie.
    """
    out: dict[str, list] = {"new": [], "changed": [], "restored": [],
                            "deleted": [], "unchanged": []}
    for key, h in seen_hashes.items():
        p = prev.get(key)
        if p is None:
            out["new"].append(key)
        elif not p["present"]:
            out["restored"].append(key)           # war weg, ist zurück
        elif p["hash"] != h:
            out["changed"].append(key)
        else:
            out["unchanged"].append(key)
    # Bisher sichtbar, jetzt nicht mehr im Scan -> gelöscht.
    out["deleted"] = [k for k, p in prev.items()
                      if p["present"] and k not in seen_hashes]
    return out


def compute_diff(old: dict | None, new: dict) -> dict:
    """Kompakter Attribut-Diff für ein CHANGED-Ereignis.

    Gibt {added, removed, changed} zurück (jeweils nur wenn nicht leer);
    changed[k] = [alt, neu]. Leeres dict, wenn es keine Attribut-Unterschiede
    gibt (sollte bei CHANGED nicht vorkommen, aber defensiv).
    """
    old = old or {}
    added = {k: v for k, v in new.items() if k not in old}
    removed = {k: v for k, v in old.items() if k not in new}
    changed = {k: [old[k], new[k]] for k in old.keys() & new.keys()
               if old[k] != new[k]}
    out: dict = {}
    if added:
        out["added"] = added
    if removed:
        out["removed"] = removed
    if changed:
        out["changed"] = changed
    return out
