"""Campus Customs MCP server.

Tools read and update data/campus_customs_new.db. They return only rows from
that file, or a refusal when a write would break a shop rule. They do not
invent stock, prices, dates, vendors, or balances.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastmcp import FastMCP

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "campus_customs_new.db"

mcp = FastMCP("Campus Customs")


def _connect() -> sqlite3.Connection:
    if not DB_PATH.is_file():
        raise FileNotFoundError(f"Working database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _one(conn: sqlite3.Connection, sql: str, params: tuple) -> dict | None:
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row is not None else None


class _db:
    """Open the working copy for one read and always close it."""

    def __enter__(self) -> sqlite3.Connection:
        self.conn = _connect()
        return self.conn

    def __exit__(self, exc_type, exc, tb) -> None:
        self.conn.close()


class _write:
    """Open one transaction. Commit only when the tool finishes without an error."""

    def __enter__(self) -> sqlite3.Connection:
        self.conn = _connect()
        self.conn.isolation_level = None
        self.conn.execute("BEGIN IMMEDIATE")
        return self.conn

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc_type is None:
                self.conn.execute("COMMIT")
            else:
                self.conn.execute("ROLLBACK")
        finally:
            self.conn.close()


_NOT_A_PERSON = {
    "agent",
    "accounting",
    "boss",
    "customer service",
    "customer_service",
    "customerservice",
    "facilities",
    "inventory",
    "system",
    "the agent",
    "the boss",
}
_TICKET_STATUSES = {"open", "resolved"}


def _shop_today(conn: sqlite3.Connection) -> str | None:
    rows = conn.execute("SELECT date_today FROM desk").fetchall()
    if len(rows) != 1:
        return None
    return rows[0]["date_today"]


def _same_money(left: float, right: float) -> bool:
    return abs(float(left) - float(right)) < 0.001


@mcp.tool
def check_stock(sku: str, size: str) -> dict:
    """Return the inventory row for one SKU and size.

    Reads inventory only. Does not substitute another size, guess a quantity,
    or describe a product that has no row for that SKU and size.
    """
    sku = sku.strip()
    size = size.strip()
    if not sku or not size:
        return {"found": False, "reason": "sku and size are required"}

    with _db() as conn:
        row = _one(
            conn,
            """
            SELECT sku, name, size, qty, location
            FROM inventory
            WHERE sku = ? AND size = ?
            """,
            (sku, size),
        )

    if row is None:
        return {"found": False, "sku": sku, "size": size}
    return {"found": True, **row}


@mcp.tool
def read_lease(lease_id: int) -> dict:
    """Return one lease and whether its next_due is before the shop's today.

    Reads leases and desk. Shop today is desk.date_today, not the wall clock.
    overdue is true only when next_due is earlier than that stored date.
    """
    with _db() as conn:
        lease = _one(
            conn,
            """
            SELECT id, space_name, landlord, monthly_rent, next_due, notes
            FROM leases
            WHERE id = ?
            """,
            (lease_id,),
        )
        desk_rows = conn.execute("SELECT date_today, notes FROM desk").fetchall()

    if lease is None:
        return {"found": False, "lease_id": lease_id}

    if len(desk_rows) != 1:
        return {
            "found": True,
            **lease,
            "date_today": None,
            "overdue": None,
            "reason": "desk must contain exactly one date_today to judge overdue",
        }

    date_today = desk_rows[0]["date_today"]
    return {
        "found": True,
        **lease,
        "date_today": date_today,
        "overdue": lease["next_due"] < date_today,
    }


@mcp.tool
def read_pricing(sku: str) -> dict:
    """Return unit_cost and list_price for one SKU.

    Reads pricing only. Does not invent a discount, a sale price, or a margin.
    """
    sku = sku.strip()
    if not sku:
        return {"found": False, "reason": "sku is required"}

    with _db() as conn:
        row = _one(
            conn,
            """
            SELECT sku, unit_cost, list_price
            FROM pricing
            WHERE sku = ?
            """,
            (sku,),
        )

    if row is None:
        return {"found": False, "sku": sku}
    return {"found": True, **row}


@mcp.tool
def read_desk() -> dict:
    """Return the shop clock from desk.

    Shop today is desk.date_today. This tool does not look at the wall clock.
    """
    with _db() as conn:
        rows = [dict(row) for row in conn.execute("SELECT date_today, notes FROM desk")]
    if len(rows) != 1:
        return {"found": False, "reason": "desk must contain exactly one row"}
    return {"found": True, **rows[0]}


@mcp.tool
def list_open_tickets() -> dict:
    """Return every ticket whose status is open.

    Reads tickets only. Does not invent a ticket or skip a row.
    """
    with _db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, type, requester, subject, sku, size, qty, lease_id,
                       invoice_id, status, notes, created_at
                FROM tickets
                WHERE status = 'open'
                ORDER BY id
                """
            )
        ]
    return {"count": len(rows), "tickets": rows}


@mcp.tool
def read_ticket(ticket_id: int) -> dict:
    """Return one ticket row.

    Reads tickets only. A missing id is not found. The tool does not guess the request.
    """
    with _db() as conn:
        row = _one(
            conn,
            """
            SELECT id, type, requester, subject, sku, size, qty, lease_id,
                   invoice_id, status, notes, created_at
            FROM tickets
            WHERE id = ?
            """,
            (ticket_id,),
        )
    if row is None:
        return {"found": False, "ticket_id": ticket_id}
    return {"found": True, **row}


@mcp.tool
def list_sizes(sku: str) -> dict:
    """Return every size row for one SKU.

    Reads inventory only. Does not fill a missing size with a quantity.
    """
    sku = sku.strip()
    if not sku:
        return {"found": False, "reason": "sku is required"}
    with _db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                """
                SELECT sku, name, size, qty, location
                FROM inventory
                WHERE sku = ?
                ORDER BY size
                """,
                (sku,),
            )
        ]
    if not rows:
        return {"found": False, "sku": sku}
    return {"found": True, "sku": sku, "sizes": rows}


@mcp.tool
def read_invoice(invoice_id: int) -> dict:
    """Return one invoice, its vendor, and whether it is overdue.

    Reads invoices, vendors, and desk. overdue is true only when due_date is
    earlier than desk.date_today. An open invoice means that vendor will not
    ship new product.
    """
    with _db() as conn:
        row = _one(
            conn,
            """
            SELECT invoices.id, invoices.vendor_id, invoices.amount, invoices.due_date,
                   invoices.status, invoices.description,
                   vendors.name AS vendor_name, vendors.specialty, vendors.lead_days
            FROM invoices
            JOIN vendors ON vendors.id = invoices.vendor_id
            WHERE invoices.id = ?
            """,
            (invoice_id,),
        )
        date_today = _shop_today(conn)
    if row is None:
        return {"found": False, "invoice_id": invoice_id}
    if date_today is None:
        return {
            "found": True,
            **row,
            "date_today": None,
            "overdue": None,
            "blocks_shipping": row["status"] == "open",
            "reason": "desk must contain exactly one date_today to judge overdue",
        }
    return {
        "found": True,
        **row,
        "date_today": date_today,
        "overdue": row["due_date"] < date_today,
        "blocks_shipping": row["status"] == "open",
    }


@mcp.tool
def list_vendors() -> dict:
    """Return every vendor.

    Reads vendors only. Lead time is lead_days. Does not add a vendor.
    """
    with _db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                "SELECT id, name, specialty, lead_days FROM vendors ORDER BY id"
            )
        ]
    return {"count": len(rows), "vendors": rows}


@mcp.tool
def read_vendor(vendor_id: int) -> dict:
    """Return one vendor and any open invoices that block shipping.

    Reads vendors, invoices, and desk. blocked is true when that vendor has
    at least one invoice with status open. Lead time is lead_days.
    """
    with _db() as conn:
        vendor = _one(
            conn,
            "SELECT id, name, specialty, lead_days FROM vendors WHERE id = ?",
            (vendor_id,),
        )
        open_invoices = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, amount, due_date, status, description
                FROM invoices
                WHERE vendor_id = ? AND status = 'open'
                ORDER BY id
                """,
                (vendor_id,),
            )
        ]
        date_today = _shop_today(conn)
    if vendor is None:
        return {"found": False, "vendor_id": vendor_id}
    return {
        "found": True,
        **vendor,
        "date_today": date_today,
        "blocked": len(open_invoices) > 0,
        "open_invoices": open_invoices,
    }


@mcp.tool
def read_cash() -> dict:
    """Return every cash account.

    Reads cash_accounts only. Cash only goes out. This tool does not add money.
    """
    with _db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                "SELECT name, balance, date FROM cash_accounts ORDER BY name"
            )
        ]
    return {"count": len(rows), "accounts": rows}


@mcp.tool
def list_payments() -> dict:
    """Return every payment that has already left the shop.

    Reads payments only. An empty list means no payment has been recorded.
    """
    with _db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                """
                SELECT id, kind, ref_id, amount, account, paid_at, approved_by
                FROM payments
                ORDER BY id
                """
            )
        ]
    return {"count": len(rows), "payments": rows}


@mcp.tool
def append_ticket_note(ticket_id: int, note: str) -> dict:
    """Append one draft to a ticket's notes.

    Writes tickets.notes only. This does not email a customer or call a vendor.
    The draft stays on the board.
    """
    note = note.strip()
    if not note:
        return {"updated": False, "reason": "note is empty"}
    with _write() as conn:
        row = _one(conn, "SELECT id, notes FROM tickets WHERE id = ?", (ticket_id,))
        if row is None:
            return {"updated": False, "ticket_id": ticket_id, "reason": "ticket not found"}
        existing = (row["notes"] or "").strip()
        combined = note if not existing else f"{existing}\n{note}"
        conn.execute("UPDATE tickets SET notes = ? WHERE id = ?", (combined, ticket_id))
    return {"updated": True, "ticket_id": ticket_id, "notes": combined}


@mcp.tool
def set_ticket_status(ticket_id: int, status: str) -> dict:
    """Set a ticket's status to open or resolved.

    Writes tickets.status only. Any other status is refused.
    """
    status = status.strip().lower()
    if status not in _TICKET_STATUSES:
        return {
            "updated": False,
            "reason": "status must be open or resolved",
            "status": status,
        }
    with _write() as conn:
        row = _one(conn, "SELECT id FROM tickets WHERE id = ?", (ticket_id,))
        if row is None:
            return {"updated": False, "ticket_id": ticket_id, "reason": "ticket not found"}
        conn.execute("UPDATE tickets SET status = ? WHERE id = ?", (status, ticket_id))
    return {"updated": True, "ticket_id": ticket_id, "status": status}


@mcp.tool
def pay(kind: str, ref_id: int, amount: float, account: str, approved_by: str) -> dict:
    """Pay an open invoice or one month of rent from a cash account.

    A human name in approved_by is required. Agent names are refused.
    The amount must match the open invoice or the lease monthly_rent.
    The payment is refused when the account cannot cover it, so the balance
    cannot go negative. On success this inserts payments, subtracts the amount
    from cash_accounts, and marks an invoice status paid. Cash is not increased.
    """
    kind = kind.strip().lower()
    approved_by = approved_by.strip()
    account = account.strip()
    if kind not in {"invoice", "rent"}:
        return {"paid": False, "reason": "kind must be invoice or rent"}
    if not approved_by:
        return {"paid": False, "reason": "approved_by is required. A human must approve the payment."}
    if approved_by.casefold() in _NOT_A_PERSON:
        return {"paid": False, "reason": "approved_by must be a person, not an agent."}
    if not account:
        return {"paid": False, "reason": "account is required"}
    if amount <= 0:
        return {"paid": False, "reason": "amount must be greater than zero"}

    with _write() as conn:
        date_today = _shop_today(conn)
        if date_today is None:
            return {"paid": False, "reason": "desk must contain exactly one date_today"}

        if kind == "invoice":
            bill = _one(
                conn,
                "SELECT id, amount, status FROM invoices WHERE id = ?",
                (ref_id,),
            )
            if bill is None:
                return {"paid": False, "reason": "invoice not found", "ref_id": ref_id}
            if bill["status"] != "open":
                return {"paid": False, "reason": "invoice is not open", "status": bill["status"]}
            if not _same_money(amount, bill["amount"]):
                return {
                    "paid": False,
                    "reason": "amount must match the open invoice",
                    "invoice_amount": bill["amount"],
                }
        else:
            lease = _one(
                conn,
                "SELECT id, monthly_rent FROM leases WHERE id = ?",
                (ref_id,),
            )
            if lease is None:
                return {"paid": False, "reason": "lease not found", "ref_id": ref_id}
            if not _same_money(amount, lease["monthly_rent"]):
                return {
                    "paid": False,
                    "reason": "amount must match monthly_rent",
                    "monthly_rent": lease["monthly_rent"],
                }

        cash = _one(
            conn,
            "SELECT name, balance FROM cash_accounts WHERE name = ?",
            (account,),
        )
        if cash is None:
            return {"paid": False, "reason": "cash account not found", "account": account}
        if float(cash["balance"]) < float(amount):
            return {
                "paid": False,
                "reason": "not enough cash",
                "balance": cash["balance"],
                "amount": amount,
            }

        conn.execute(
            """
            UPDATE cash_accounts
            SET balance = balance - ?, date = ?
            WHERE name = ? AND balance >= ?
            """,
            (amount, date_today, account, amount),
        )
        updated = _one(
            conn,
            "SELECT name, balance, date FROM cash_accounts WHERE name = ?",
            (account,),
        )
        if updated is None or float(updated["balance"]) < 0:
            raise RuntimeError("cash update failed")
        cursor = conn.execute(
            """
            INSERT INTO payments (kind, ref_id, amount, account, paid_at, approved_by)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (kind, ref_id, amount, account, date_today, approved_by),
        )
        if kind == "invoice":
            conn.execute("UPDATE invoices SET status = 'paid' WHERE id = ?", (ref_id,))
        payment = _one(
            conn,
            """
            SELECT id, kind, ref_id, amount, account, paid_at, approved_by
            FROM payments
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        )
    return {"paid": True, "payment": payment, "account": updated}


if __name__ == "__main__":
    mcp.run(transport="stdio", show_banner=False)
