"""Append-only audit trail for agent-loop steps.

The file is output/audit_trail.json. A run adds steps. It does not replace
the file. If the file exists and is not a JSON list, the write is refused
so a bad read cannot wipe the trail.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from backend.models import AuditStep

ROOT = Path(__file__).resolve().parent.parent
AUDIT_PATH = ROOT / "output" / "audit_trail.json"
_lock = Lock()


class AuditTrailError(RuntimeError):
    """The trail could not be appended without destroying what is already there."""


def append_audit(agent: str, kind: str, detail: dict, depth: int = 0) -> None:
    step = AuditStep(
        recorded_at=datetime.now(timezone.utc).isoformat(),
        agent=agent,
        kind=kind,
        depth=depth,
        detail=detail,
    )
    payload = step.model_dump()
    with _lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > 0:
            try:
                current = json.loads(AUDIT_PATH.read_text())
            except json.JSONDecodeError as exc:
                raise AuditTrailError(
                    f"{AUDIT_PATH} is not valid JSON. Refusing to overwrite it."
                ) from exc
            if not isinstance(current, list):
                raise AuditTrailError(
                    f"{AUDIT_PATH} is not a list. Refusing to overwrite it."
                )
        else:
            current = []
        current.append(payload)
        AUDIT_PATH.write_text(json.dumps(current, indent=2) + "\n")
