# HW 5 harness

How the Campus Customs shop is put together for the agent team. Later problems add models, tools, safety, and run specs here.

Database: `data/campus_customs.db` is the original and stays untouched. `data/campus_customs_new.db` is the working copy. Later problems update only the working copy. Before a full ticket run, copy the original over the working file again.

Shop today comes from `desk.date_today`: **2026-08-31**. Overdue is measured against that date.

Nine tables. Three tickets are open. `payments` is empty.

---

## desk

One row. This is the shop clock and the desk notepad.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `date_today` | Text date. The only row is `2026-08-31`. | This is today for the shop. Agents use it to decide what is overdue. |
| `notes` | Optional text. Empty on the only row. | A place for desk notes. Nothing is stored yet. |

## tickets

The board. One row per request. All three rows are `open`.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `id` | Integer primary key. Current ids: 101, 102, 103. | How the boss names a ticket and how tools update it. |
| `type` | Kind of work: `customer_order`, `rent_notice`, or `price_override`. | Tells the boss which agents to bring in. |
| `requester` | Who asked. A person, a landlord, or a student org. | Who customer service writes to, and who facilities or accounting is dealing with. |
| `subject` | Short title. | What the dashboard shows on the card. |
| `sku` | Product code, or null when the ticket is not about merch. | Joins to `inventory` and `pricing`. |
| `size` | Size asked for, or null. | Stock is per SKU and size, so this is required for an order or a bulk request. |
| `qty` | Units asked for, or null. | Compared with `inventory.qty` to spot a shortfall. |
| `lease_id` | Foreign key to `leases.id`, or null. | Ties a rent ticket to the shop space. |
| `invoice_id` | Foreign key to `invoices.id`, or null. | Ties a ticket to a vendor bill that may block a restock. |
| `status` | `open` on every current row. | The board only works tickets that are still open. Tools set this as a ticket is resolved. |
| `notes` | Free text from the requester. | The detail the agents read before they decide. |
| `created_at` | Text timestamp with timezone. All three were opened on `2026-08-31`. | When the ticket landed. Shop today is the same calendar day. |

## inventory

One row per SKU and size. Stock lives here.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `sku` | Product code. Part of the primary key with `size`. | The inventory agent's lookup key. Matches `tickets.sku` and `pricing.sku`. |
| `name` | Display name (example: `Classic Bulldog Tee`). | How agents and the dashboard name the item. |
| `size` | `S`, `M`, `L`, `XL`, or `OS` (one size). Part of the primary key. | Stock is not a single number. A size can be out while other sizes are in. |
| `qty` | Integer units on hand. | `0` is a shortfall. Compared with `tickets.qty`. |
| `location` | Aisle label (`Aisle A` through `Aisle D`). | Where the shop would pull the item. |

Current stock that the open tickets touch: `CC-TEE-WHITE` / `S` is **0**. `CC-HOOD-NAVY` / `M` is **8**. `CC-MUG-CREST` / `OS` is also 0, but no open ticket asks for it.

## pricing

One row per SKU. Cost and list price. No sale price is stored.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `sku` | Primary key. Matches `inventory.sku`. | How accounting prices an order or a discount. |
| `unit_cost` | What the shop pays per unit. | Margin is `list_price - unit_cost`. A discount below cost loses money. |
| `list_price` | What the shop charges per unit. | The starting price for a customer order or a bulk request. |

Prices the open tickets touch: `CC-TEE-WHITE` costs 8 and lists at 28. `CC-HOOD-NAVY` costs 22 and lists at 58.

## vendors

Who can restock. Lead time is on this table.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `id` | Integer primary key. | `invoices.vendor_id` points here. |
| `name` | Vendor name. | Who inventory names when it proposes a restock. |
| `specialty` | What they supply: apparel reprint, mugs and small goods, or local courier. | Which vendor fits the SKU. Apparel is not the mug vendor. |
| `lead_days` | Integer days until they can deliver. | The only source of lead time. Do not invent a faster date. |

Three vendors: Bulldog Print Co (id 1, apparel reprint, 5 days), Elm City Gifts (id 2, mugs and small goods, 3 days), QuickShip CT (id 3, local courier, 1 day).

## invoices

Vendor bills. A vendor with an open unpaid invoice will not ship new product.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `id` | Integer primary key. The only row is 501. | `tickets.invoice_id` points here. |
| `vendor_id` | Foreign key to `vendors.id`. | Which vendor is blocked until this bill is paid. |
| `amount` | Dollars owed. The only row is 840. | Accounting checks this against cash before a payment. |
| `due_date` | Text date. The only row is `2026-08-28`. | Compared with `desk.date_today`. `2026-08-28` is before `2026-08-31`, so this bill is overdue. |
| `status` | `open` on the only row. | `open` means unpaid. That blocks new shipments from this vendor. |
| `description` | What the bill is for. | Ties the bill to a SKU in words: rush reprint of `CC-TEE-WHITE` size S. |

## leases

The shop space. Rent comes from here.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `id` | Integer primary key. The only row is 1. | `tickets.lease_id` points here. |
| `space_name` | `Chapel Street shop`. | Which space the facilities agent is talking about. |
| `landlord` | `Elm City Properties`. | Matches the requester on the rent ticket. |
| `monthly_rent` | Dollars. The only row is 2400. | The amount a rent payment would take from cash. |
| `next_due` | Text date. The only row is `2026-09-02`. | Compared with shop today `2026-08-31`. Rent is due in 2 days. It is not overdue yet. |
| `notes` | Optional text. Empty on the only row. | Extra lease terms. None are stored. |

## cash_accounts

The shop's money. Cash only goes out in this homework.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `name` | Primary key. The only account is `checking`. | The account a payment is drawn from. `payments.account` should match this. |
| `balance` | Dollars on hand. The only row is 3400. | The pay tool must refuse if a payment would make this negative. |
| `date` | Text date of the balance. `2026-08-31`, same as shop today. | When this balance was last true. |

## payments

Record of money that already left. Empty until a human-approved payment is written.

| Field | Definition | Why it matters |
| --- | --- | --- |
| `id` | Integer primary key. | One row per payment that actually happened. |
| `kind` | What was paid (rent, vendor invoice, and so on). | Tells later tools which table `ref_id` belongs to. |
| `ref_id` | Id of the related lease, invoice, or other row. Nullable. | Links the cash leaving to the bill or lease it settled. |
| `amount` | Dollars paid. | Subtracted from `cash_accounts.balance`. Never more than the balance. |
| `account` | Which cash account paid. | Must be an account that exists, currently `checking`. |
| `paid_at` | When it was paid. | Should follow shop today, not the real calendar. |
| `approved_by` | Who approved it. Required. | Human approval is mandatory. A payment row without a person here is not allowed. |

---

## How the three open tickets link

Shop today is `2026-08-31`. Checking balance is 3400. No payments exist yet.

### Ticket 101 — customer order, Bulldog tee

Tauhid Zaman wants 1 `CC-TEE-WHITE` in size S. `invoice_id` is 501. `lease_id` is null.

- Inventory: size S of that SKU has qty 0. Sizes M, L, and XL are in stock (5, 3, 2). The order cannot be filled from the shelf.
- Pricing: unit cost 8, list price 28.
- Invoice 501 is an open bill for 840, due `2026-08-28`, described as a rush reprint of `CC-TEE-WHITE` size S. Due date is before shop today, so the bill is overdue.
- Vendor 1 is Bulldog Print Co, specialty apparel reprint, lead time 5 days. Because invoice 501 is still open, this vendor will not ship new product until the bill is paid.
- 840 is less than the 3400 checking balance, so a payment is possible only after a human approves it. Paying it would also clear the block on that vendor.

### Ticket 102 — rent notice

Elm City Properties says shop rent is due in 2 days. `lease_id` is 1. No SKU and no invoice.

- Lease 1 is the Chapel Street shop, same landlord, monthly rent 2400, `next_due` `2026-09-02`.
- Shop today is `2026-08-31`, so rent is due in 2 days. It is not overdue.
- 2400 is less than 3400, so the shop can pay it if a human approves. Paying both this rent and invoice 501 (840) would leave 160 in checking. Paying either one alone also fits. The pay tool must still refuse if a later balance cannot cover the amount.

### Ticket 103 — price override, bulk hoodie discount

Yale AI Club wants 20 `CC-HOOD-NAVY` hoodies in size M at a bulk discount. No lease and no invoice on the ticket.

- Inventory: size M has qty 8. The shop is 12 short of 20. Other sizes of the same SKU are in stock (S 4, L 14, XL 6) but the request is specifically size M.
- Pricing: unit cost 22, list price 58. List margin is 36 per hoodie. Twenty at list would be 1160. Accounting has to check any discount against that 22 cost so the shop does not sell below cost.
- Restock of apparel points at Bulldog Print Co (vendor 1, 5-day lead). That vendor still has open invoice 501, so they will not ship a new order until that bill is paid. Elm City Gifts supplies mugs, and QuickShip CT is a courier. Neither is the apparel reprint vendor.

---

## Agents

The team is in `backend/team.py`. Prompts are one file per role in `backend/prompts/`. Every agent uses `gpt-6-luna` through Portkey. Shop rows come from the MCP server, not from a second database layer. Any agent can delegate to any other agent. A delegation chain stops at depth 3, and each agent asks each teammate only once on a ticket so a circle cannot keep spending the token cap.

| Agent | Prompt | What this agent decides |
| --- | --- | --- |
| boss | `backend/prompts/boss.md` | Reads the open ticket, sends it to the specialist, and writes the final call. Does not pay. |
| inventory | `backend/prompts/inventory.md` | Stock by SKU and size, the shortfall, and whether the vendor row is blocked by an open invoice. |
| accounting | `backend/prompts/accounting.md` | Cash, invoice amount, margin against unit cost, and a payment prepared for a human. |
| facilities | `backend/prompts/facilities.md` | Lease, rent amount, and whether `next_due` is before shop today. |
| customer service | `backend/prompts/customer_service.md` | The draft that stays on the ticket. Does not email. |

## MCP tools

The server is `mcp_server/server.py` (FastMCP). It uses `data/campus_customs_new.db`. A missing id comes back as not found. Writes refuse when they would break a shop rule.

### `check_stock`

| | |
| --- | --- |
| Uses | `inventory` |
| Unlocks | 101 |

Ticket 101 asks for 1 `CC-TEE-WHITE` in size S, and the inventory row for that SKU and size has qty 0, so the tee is not on the shelf and the order cannot be picked. The same read is what shows ticket 103 is short: `CC-HOOD-NAVY` size M has qty 8 against the 20 requested.

### `read_lease`

| | |
| --- | --- |
| Uses | `leases`, `desk` |
| Unlocks | 102 |

Ticket 102 points at lease 1, and that row is the Chapel Street shop at monthly rent 2400 with `next_due` `2026-09-02`, which is after `desk.date_today` `2026-08-31`, so facilities can see the rent is not overdue.

### `read_pricing`

| | |
| --- | --- |
| Uses | `pricing` |
| Unlocks | 103 |

Ticket 103 asks for a bulk discount on `CC-HOOD-NAVY`, and the pricing row is the only place that SKU's unit cost 22 and list price 58 are stored, so accounting can judge the discount from those figures.

### `read_desk`

| | |
| --- | --- |
| Uses | `desk` |
| Unlocks | 101, 102, 103 |

Shop today is the single `date_today` value `2026-08-31`. Ticket 101's invoice is overdue only against that date, and ticket 102's rent is due two days after it.

### `list_open_tickets`

| | |
| --- | --- |
| Uses | `tickets` |
| Unlocks | 101, 102, 103 |

The boss starts from the three rows whose status is `open`: the tee order, the rent notice, and the hoodie discount.

### `read_ticket`

| | |
| --- | --- |
| Uses | `tickets` |
| Unlocks | 101, 102, 103 |

Each ticket's type, requester, SKU or lease id, and notes are on its own row, so the team does not guess what Tauhid, Elm City Properties, or the Yale AI Club asked for.

### `list_sizes`

| | |
| --- | --- |
| Uses | `inventory` |
| Unlocks | 101 |

Ticket 101 needs size S, and the other sizes of `CC-TEE-WHITE` are a different row. Listing them shows M, L, and XL are in stock without treating those rows as a filled size S order.

### `read_invoice`

| | |
| --- | --- |
| Uses | `invoices`, `vendors`, `desk` |
| Unlocks | 101 |

Ticket 101 points at invoice 501, an open 840 bill due `2026-08-28` for the rush reprint of `CC-TEE-WHITE` size S. That due date is before shop today, and an open bill blocks Bulldog Print Co from shipping.

### `list_vendors`

| | |
| --- | --- |
| Uses | `vendors` |
| Unlocks | 101 |

The restock for ticket 101 has to be chosen from the three vendor rows. Apparel reprint is Bulldog Print Co. The mug vendor and the courier are different specialties.

### `read_vendor`

| | |
| --- | --- |
| Uses | `vendors`, `invoices`, `desk` |
| Unlocks | 101 |

Vendor 1 is Bulldog Print Co, lead time 5 days, and this tool also returns open invoice 501, so inventory can see the reprint vendor is blocked until that bill is paid. Ticket 103's hoodie restock hits the same block.

### `read_cash`

| | |
| --- | --- |
| Uses | `cash_accounts` |
| Unlocks | 101 |

Checking has 3400. Ticket 101's 840 invoice and ticket 102's 2400 rent each fit in that balance, and the pay tool still has to refuse a later amount that does not.

### `list_payments`

| | |
| --- | --- |
| Uses | `payments` |
| Unlocks | 101 |

The payments table is empty, so ticket 101's invoice 501 has not been paid and the vendor block is still in force.

### `append_ticket_note`

| | |
| --- | --- |
| Uses | `tickets` |
| Unlocks | 103 |

Ticket 103 needs a reply to the Yale AI Club about the hoodie discount. This tool appends that draft to the ticket notes and does not email the club. The same board is where the tee reply and the landlord reply stay.

### `set_ticket_status`

| | |
| --- | --- |
| Uses | `tickets` |
| Unlocks | 102 |

The boss can leave ticket 102 `open` while rent is waiting on a human, and may set `resolved` only after the call does not still depend on a payment.

### `pay`

| | |
| --- | --- |
| Uses | `payments`, `cash_accounts`, `invoices` or `leases`, `desk` |
| Unlocks | 101 |

Ticket 101 cannot clear the vendor block until invoice 501 is paid. This tool pays that 840 bill only when a human name is in `approved_by`, the amount matches the open invoice, and checking can cover it. It then writes `payments`, subtracts cash, and sets the invoice status to `paid`. The same guard covers ticket 102's 2400 rent.

## Safety

A real shop would not let an agent talk to customers or move money on its own.

- Payments need a human name in `approved_by`. The pay tool refuses agent names, a blank approver, an amount that does not match the bill or the monthly rent, and any amount the cash account cannot cover. The balance is not allowed to go negative. Cash is not increased, because this homework has no revenue.
- Customer and landlord drafts are appended to `tickets.notes`. Nothing is emailed and no vendor is called. A person should read the draft before it ever left the board.
- Agents may not invent a SKU, a price, a vendor, or a date. A tool result of not found stays not found.
- The boss, not the model that drafted the reply, decides when a ticket is resolved. A ticket that still needs a payment stays `open`.
- Token use is capped for one boss run and every delegation under it: 48 model requests, 80 tool calls, and 200,000 total tokens. Delegation depth stops at 3. Each agent retries a bad tool result once. The audit trail at `output/audit_trail.json` appends every tool call, tool result, delegation, and final step, and a run does not wipe that file. `gpt-6-luna` is called with reasoning effort `none` so the model can use tools.

### `check_stock`

| | |
| --- | --- |
| Reads | `inventory` |
| Unlocks | 101 |

Ticket 101 asks for 1 `CC-TEE-WHITE` in size S, and the inventory row for that SKU and size has qty 0, so the tee is not on the shelf and the order cannot be picked. The same read is what shows ticket 103 is short: `CC-HOOD-NAVY` size M has qty 8 against the 20 requested.

### `read_lease`

| | |
| --- | --- |
| Reads | `leases`, `desk` |
| Unlocks | 102 |

Ticket 102 points at lease 1, and that row is the Chapel Street shop at monthly rent 2400 with `next_due` `2026-09-02`, which is after `desk.date_today` `2026-08-31`, so facilities can see the rent is not overdue.

### `read_pricing`

| | |
| --- | --- |
| Reads | `pricing` |
| Unlocks | 103 |

Ticket 103 asks for a bulk discount on `CC-HOOD-NAVY`, and the pricing row is the only place that SKU's unit cost 22 and list price 58 are stored, so accounting can judge the discount from those figures.

## Routes

The board API is `backend/main.py`. From the `backend/` folder, `uvicorn main:app --reload --port 8000` serves it at `http://localhost:8000`. The Vite desk at `http://localhost:5173` is allowed by CORS. Agents still only prepare a payment. `POST /approve` is the human click that calls `pay` and changes cash.

- `GET /tickets` — returns tickets 101, 102, and 103 and whether each is open or resolved.
- `POST /tickets/{ticket_id}/run` — runs the agent team on that ticket, then marks that ticket resolved. It does not pay anything.
- `GET /events` — returns recent agent events: what each agent said and which tools they used.
- `POST /approve` — a human approves a prepared invoice or rent payment, and this call is what changes cash.
- `GET /cash` — returns the current checking balance from `cash_accounts`.
- `POST /reset` — copies `data/campus_customs.db` over `data/campus_customs_new.db` for a fresh run.

## Dashboard

The desk is `frontend/`, React with Vite and TypeScript. `npm run dev` serves it at `http://localhost:5173`, and it calls `http://localhost:8000`. The look is written up in `output/design.md`.

One screen holds the ticket spike, the selected ticket with its Start button, five agent desks, and the checking balance with any approval card. While a run is in progress the page polls `GET /events` and shows each agent's line, the MCP tools it used, and an arrow when one agent hands work to another. When the run returns, `POST /tickets/{ticket_id}/run` has marked that ticket resolved. A prepared invoice or rent payment is approved with `POST /approve`, which is the call that changes cash. The balance then animates down to the new `GET /cash` figure.

The resolved run is appended in `output/audit_trail.json`. After reset, checking started at $3,400. Shop owner approved invoice 501 for $840 and lease 1 rent for $2,400. Ticket 103 moved no money. Checking ended at $160, which matches `cash_accounts`.
