"""Campus Customs board API.

Start this from the backend/ folder:

    uvicorn main:app --reload --port 8000

The React board calls these routes. Agents prepare a payment. POST /approve
is the human click that actually changes cash, and it does that by calling
the same pay tool the MCP server uses.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.audit import AUDIT_PATH  # noqa: E402
from backend.team import run_boss  # noqa: E402
from mcp_server.server import DB_PATH, pay, set_ticket_status  # noqa: E402

ORIGINAL_DB = DB_PATH.with_name("campus_customs.db")
TICKET_IDS = (101, 102, 103)

app = FastAPI(title="Campus Customs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApproveBody(BaseModel):
    """A human approving one prepared invoice or rent payment."""

    kind: str
    ref_id: int
    amount: float
    approved_by: str
    account: str = "checking"


def _connect() -> sqlite3.Connection:
    if not DB_PATH.is_file():
        raise HTTPException(status_code=500, detail=f"Working database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _tickets() -> list[dict]:
    placeholders = ",".join("?" for _ in TICKET_IDS)
    sql = f"""
        SELECT id, type, requester, subject, sku, size, qty, lease_id,
               invoice_id, status, notes, created_at
        FROM tickets
        WHERE id IN ({placeholders})
        ORDER BY id
    """
    conn = _connect()
    try:
        return [dict(row) for row in conn.execute(sql, TICKET_IDS)]
    finally:
        conn.close()


def _checking() -> dict:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT name, balance, date FROM cash_accounts WHERE name = ?",
            ("checking",),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="checking account not found")
    return dict(row)


@app.get("/tickets")
def list_tickets() -> dict:
    """Tickets 101, 102, and 103, each marked open or resolved."""
    rows = _tickets()
    return {
        "tickets": [
            {
                "id": row["id"],
                "type": row["type"],
                "requester": row["requester"],
                "subject": row["subject"],
                "status": row["status"],
                "sku": row["sku"],
                "size": row["size"],
                "qty": row["qty"],
                "lease_id": row["lease_id"],
                "invoice_id": row["invoice_id"],
                "notes": row["notes"],
            }
            for row in rows
        ]
    }


@app.post("/tickets/{ticket_id}/run")
async def run_ticket(ticket_id: int) -> dict:
    """Run the boss and the team on one ticket. This does not pay anything."""
    known = {row["id"] for row in _tickets()}
    if ticket_id not in known:
        raise HTTPException(status_code=404, detail=f"ticket {ticket_id} is not on the board")
    task = (
        f"Work ticket {ticket_id}. "
        "Call read_desk, then read_ticket for this id. "
        "Delegate only the specialists this ticket type needs. "
        "Do not call pay. "
        "Leave the ticket open if a payment or a discount still needs a person."
    )
    report = await run_boss(task)
    status = set_ticket_status(ticket_id, "resolved")
    return {
        "ticket_id": ticket_id,
        "status": status.get("status", "resolved"),
        "report": report.model_dump(),
    }


@app.get("/events")
def recent_events(limit: int = 50) -> dict:
    """Recent audit steps: what each agent said and which tools they used."""
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit must be at least 1")
    if not AUDIT_PATH.exists() or AUDIT_PATH.stat().st_size == 0:
        return {"events": []}
    try:
        current = json.loads(AUDIT_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail="audit trail is not valid JSON",
        ) from exc
    if not isinstance(current, list):
        raise HTTPException(status_code=500, detail="audit trail is not a list")
    return {"events": current[-limit:]}


@app.post("/approve")
def approve_payment(body: ApproveBody) -> dict:
    """Human approval. This route is what calls pay and changes cash."""
    result = pay(
        kind=body.kind,
        ref_id=body.ref_id,
        amount=body.amount,
        account=body.account,
        approved_by=body.approved_by,
    )
    if not result.get("paid"):
        raise HTTPException(status_code=400, detail=result)
    return result


@app.get("/cash")
def checking_balance() -> dict:
    """Current checking balance from cash_accounts."""
    row = _checking()
    return {"account": row["name"], "balance": row["balance"], "date": row["date"]}


@app.post("/reset")
def reset_database() -> dict:
    """Copy the original database over the working copy. The audit trail stays."""
    if not ORIGINAL_DB.is_file():
        raise HTTPException(status_code=500, detail=f"Original database not found: {ORIGINAL_DB}")
    shutil.copyfile(ORIGINAL_DB, DB_PATH)
    for suffix in ("-wal", "-shm"):
        extra = Path(str(DB_PATH) + suffix)
        if extra.exists():
            extra.unlink()
    return {
        "reset": True,
        "database": "data/campus_customs_new.db",
        "audit_kept": True,
    }
