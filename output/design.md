# Campus Customs desk

The board is a print-shop counter, not a software admin screen. Cream paper, deep ink-blue type, and one school-spirit orange for the things a person can press: start the team, and sign a payment.

## Layout

Everything sits on one desk. A masthead names the shop and carries a round "shop today" stamp, August 31, because that is the shop clock.

Under it, three zones:

- The left rail is the ticket spike. Tickets 101, 102, and 103 are paper slips with a perforated edge. Each slip shows an Open or Resolved badge. The selected slip gets an orange outline.
- The center is the job on the counter: who asked, the note they left, and the Start button. Under that, five agent desks and, when a run finishes, a short wrap-up.
- The right rail is the cash drawer and the signature card. The balance is always visible. Approvals appear there, so nobody hunts through another page.

On a narrow window the three zones stack, spike first, so the same page still works.

## How the agents read differently

Each person has a seal, a color, and a job title, so the floor is readable at a glance.

- Boss is navy, the floor lead.
- Inventory is green, the stock room.
- Accounting is amber, the cash drawer.
- Facilities is brick, the lease book.
- Customer service is teal, the front counter.

An idle desk is dim. A working desk pulses in its own color and speaks in a paper speech bubble: "Counting what is on the shelf," "Opening the vendor bill," and so on. Small chips name the MCP tools that desk just used. When one agent hands work to another, an orange dashed arrow runs between their cards and settles to an ink line once the answer comes back. After the run, anyone who never got a task is marked "not called," so a rent ticket that never needed inventory is obvious.

## Resolved tickets and cash

The spike badge and the big badge on the blotter both read the ticket status from the API. Open is an orange pill. Resolved is a green stamp. When a run finishes, the backend marks that ticket resolved, the badge flips, and a few scraps of paper fall across the blotter.

Checking is the large number on the right, read from `cash_accounts`. Approving a prepared invoice or rent payment calls `POST /approve`. The number then eases down to the new balance and flashes orange, so the drop is visible and matches the drawer. Declining sends nothing, and the balance stays put. A discount that needs a person, with no bill attached, shows as a note instead of a payment card.

## What makes it feel like a desk

The background is a warm wood-grain wash with a paper tooth, and the cards are rounded with soft shadows instead of flat white panels. Slips look pinned, not listed. The approval card slides in as a signature moment: the amount is the largest type on the rail, the payee is named, and Approve is the same orange as Start. Empty and error states talk like the shop ("The spike is empty," "The back room isn't answering") so a quiet board still feels looked after.
