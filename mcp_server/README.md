# Campus Customs MCP server

This server is the tool layer for the shop's agent team. The boss, inventory, accounting, facilities, and customer service agents call these tools instead of opening the database themselves.

It uses the working copy `data/campus_customs_new.db`, resolved from the homework root next to this folder. `data/campus_customs.db` is the untouched original and is not opened here.

A missing SKU, size, lease, invoice, ticket, or vendor comes back as not found. The tools do not fill in a quantity, a price, a vendor, or a date. `pay` refuses when a human has not approved it or when the cash account cannot cover the amount.

## Tools

| Tool | Tables | What it does |
| --- | --- | --- |
| `check_stock(sku, size)` | `inventory` | The one stock row for that SKU and size. |
| `read_lease(lease_id)` | `leases`, `desk` | That lease, shop today, and whether `next_due` is before shop today. |
| `read_pricing(sku)` | `pricing` | `unit_cost` and `list_price` for that SKU. |
| `read_desk()` | `desk` | Shop today, `date_today`. |
| `list_open_tickets()` | `tickets` | Every ticket with status `open`. |
| `read_ticket(ticket_id)` | `tickets` | One ticket. |
| `list_sizes(sku)` | `inventory` | Every size row for one SKU. |
| `read_invoice(invoice_id)` | `invoices`, `vendors`, `desk` | That bill, its vendor, and whether it is overdue. An open bill blocks shipping. |
| `list_vendors()` | `vendors` | Every vendor, including `lead_days`. |
| `read_vendor(vendor_id)` | `vendors`, `invoices`, `desk` | That vendor and any open invoices that block shipping. |
| `read_cash()` | `cash_accounts` | Account name, balance, and balance date. |
| `list_payments()` | `payments` | Payments already recorded. |
| `append_ticket_note(ticket_id, note)` | `tickets` | Appends a draft to the ticket. Does not email anyone. |
| `set_ticket_status(ticket_id, status)` | `tickets` | Sets status to `open` or `resolved`. |
| `pay(kind, ref_id, amount, account, approved_by)` | `payments`, `cash_accounts`, `invoices` or `leases`, `desk` | Pays an open invoice or one month of rent after a human approves it. Refuses a short balance. |

The server is `mcp_server/server.py`, built with FastMCP.
