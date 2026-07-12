"""Session-Cookie verifizieren — exakt dasselbe Format wie web/src/lib/session.ts.

  cookie = <token>.<sig>
  token  = base64url(JSON({"exp": <unix>}))
  sig    = base64url(HMAC_SHA256(secret, token))

Wir signieren hier nie (das macht die Web-App beim /unlock), wir verifizieren
nur — deshalb wird der empfangene token-String direkt gehasht, kein erneutes
JSON-Serialisieren (sprachneutral).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


def _b64url_decode(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    s += "=" * (-len(s) % 4)
    return base64.b64decode(s)


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def verify_session(secret: str, value: str | None) -> bool:
    if not secret or not value or "." not in value:
        return False
    token, _, sig = value.rpartition(".")
    expected = _b64url(hmac.new(secret.encode("utf-8"), token.encode("utf-8"),
                                hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        payload = json.loads(_b64url_decode(token))
    except Exception:  # noqa: BLE001
        return False
    exp = payload.get("exp")
    return isinstance(exp, (int, float)) and exp > time.time()
