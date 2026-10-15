# AI Prompts Log — HW 5

One section per problem. Each section has the problem number and title, and at least one prompt typed in the user's own words.

This file is the log of what was typed to the coding assistant. It will be kept updated as the assignment continues.

Assignment: Campus Customs multi-agent operations. An agent team runs the shop. Open tickets land on a board (customer orders, rent, unpaid bills, discount requests, and whatever else the shop has to handle). Three pieces talk to each other: an MCP server, a FastAPI backend with a multi-agent team, and a React dashboard so a human can watch the agents and approve requests. Any agent may delegate to any other agent. Agents: boss, inventory, accounting, facilities, customer service. Original database is `data/campus_customs.db` and stays untouched. Working copy is `data/campus_customs_new.db`. Every agent call uses `PORTKEY_API_KEY` and only `gpt-6-luna` through Portkey.

---

## Problem 1: Vibe coder prompts

**Prompt I typed in**

```
i am doing a new hw ready?
```

**Follow-up prompts**

```
this is the scenario of the project and will have smaller problems just like the previous projects

the scenario is that campus customs multi agent operations is the agentic team that runs the shop. open ticket lands on a board, with customer orders, rent, unpaid bills, discount requests, whatever the shop has to handle. You will build 3 pieces that talk to each other: an MCP server, a fastAPI backend with a multi-agent team, and a react dashboard so a human can watch the agents at work and approve requests

my agent team will have full connectivity - any agent may delegate tasks to any other agent for help. in this assignment you will build these agents:
1. boss - read each ticket, decides who should work on it and make final calls
2. inventory - checks stock by SKU and size, spots shortfalls, and figures out which vendor can restock
3. accounting - watches cash and invoices, checks margins and prepares payments or purchase orders for human approval
4. facilities - handles the shop space side (leases, rent, etc)
5. customer services - drafts messages for customers

so these are the content and i will give u the data so u have data/campus_customs.db that file is the original shop database. tables include desk, tickets, inventory, pricing, vendors, leases, cash_accounts, payments, and invoices

the tools will update the database as tickets get resolved. make a copy of the database file called data/campus_customs_new.db and point your MCP server and backend at that working copy. Keep campus_customs.db untouched so you can reset when you want to restart resolving tickets

understand this first and more to come i will tell u the rules
```

```
rules of this shop
1. the field desk.date_today is today for the shop. use this date determine what is overdue
2. vendor lead times come from the vendors table
3. a vendor will not ship new product while they still have an open unpaid invoice
4. human approval is required for any payments. points will be deducted if this is not done. if payment is made, make sure to update the relevant table
5. if there's not enough cash, the pay tool must refuse - no negative balances
6. cash only goes out in this homework - we did not model revenue so no money comes in
7. before a full run to solve the tickets, make sure to reset the database to the original values
8. do not email customers or call real vendors, drafts stay on the board

use your PORTKEY_API_KEY for ai calls, for this assignment, use only gpt-6-luna through Portkey for every agent. multi-agent chats burn tokens fast. points will be deducted if any other model shows up in your code or runs

that's the brief of the scenario i will start problem 1 soon once u're ready
```

```
problem 1: vibe coder prompts
create AI_prompts.md at the start of the assignment and keep it updated as i work. this file is the log of what you typed to your vibe coder. put one section for each prblem each section must include
1. the problem number and title
2. at least one prompt you typed in your own words as much as possible
```

**What was lacking:** The first prompt only said a new homework was starting. The shop, the three pieces (MCP server, FastAPI multi-agent backend, React dashboard), full agent connectivity, the five agents, the original database versus the working copy, the shop rules, and `gpt-6-luna` through Portkey all came in later prompts. This problem is the prompt log itself.

---

## Problem 2: Study the Campus Customs database

**Prompt I typed in**

```
problem 2: study the campus customs database
open data/campus_customs.db and look through every table and its fields. copy the original file to data/campus_customs_new.db - later problems update that working copy

study the three open tickets so you see how they link with other tables let me know if u do not understand

start output/harness.md for each table list the fields and one short line on why that table matters for the agent. you will keep growing this harness file in later problems
```

---

## Problem 3: Build the MCP server

**Prompt I typed in**

```
problem 3: build the MCP server
write an MCP server in mcp_server/ using FastMCP it will talk to data/campus_customs_new.db you do not need to connect or run it in this problem every agent in this homework uses the tools in this MCP server. you will add more tools to it later for now write three tools you know you will need for the tickets in the database - let me review first think of this carefully of that the 3 rules should be keep the name clear. never invent any data only use informatino in the database

then in output/harness,md list each of the three MCP tools for every tools include: which table it reads, which ticket it helps unlock (101,102, or 103) and one sentence on why that tool is the right one for that ticket. Vagues lines like reads inventory score low - tie the tool to the ticket

Also add a short mcp_server/README.md file that explains what the MCP server is for which database file it uses and the 3 tools it has
```

**Follow-up prompt**

```
we can go with these 3
```

---

## Problem 4: Add the MCP server to vibe coder and test each tool

**Prompt I typed in**

```
problem 4: add the MCP server to vibe coder and test each tool

Add the MVP server to this project so Cursor can call its tools.

Step 1: Connect the server
- Save the MCP connection JSON in `.mcp.json` at the project root. If this Cursor setup manages local MCP server lists some other way, use that method and tell me where the config was saved.
- Confirm the vibe coder server shows as connected and lists its 3 MCP tools before moving on.

Step 2: Smoke test all 3 MCP tools
With the vibe coder connected, call each of the 3 MCP tools through the real MCP connection. Do not mock or hand-write any outputs.

Step 3: Save the evidence
Save the results in `output/mcp_smoke.json`. For each tool, include:
1. `prompt`: the exact prompt I asked you to run for that tool
2. `tool_name`: the name of the MCP tool that was called
3. `tool_output`: the raw output the tool returned

Requirements
- Every `tool_output` must match the actual values in `data/campus_customs_new.db`. Query the database directly to verify each one.
- If a tool output does not match the database, report the mismatch instead of editing the output to fit.
- Do not rename or move any files. Use the exact paths `.mcp.json`, `output/mcp_smoke.json`, and `data/campus_customs_new.db`.
```

**Follow-up prompts**

```
how do i enable that server
```

```
where can i find customize
```

```
where should i click
```

```
ok i toggle
```

---

## Problem 5: Build the agent team and grow the MCP tools

**Prompt I typed in**

```
problem 5: build the agent team and grow the MCP tools
Build the agentic team for Campus Customs using PydanticAI. The team has five agents: boss, inventory, accounting, facilities, and customer service.

Agent design
- Include prompts, models, and agent loops for all five agents.
- The agents must be able to delegate work to each other with full connectivity (any agent can hand work to any other agent).
- Use your portkey_api_key, and use only gpt-6-luna for every agent.

File layout
- Put the agent prompts in `backend/prompts/`, with one file per agent.
- Put the data types in `backend/models.py`.
- Put the agent files under `backend/`. The layout can vary as long as the five roles are clear.

Prompts
- Write each prompt with the shop rules that agent needs.
- More detailed prompts that cover all aspects of an agent's work and scope score higher than a short generic prompt, so be thorough.
- Let me review the prompts first before moving on.

MCP tools
- Add any tools the agents need to your MCP server so they can work on the open tickets.
- Shop facts come from the MVP server over `data/campus_customs_new.db`.
- Do not invent a second shop-tools layer that bypasses MCP.

Audit trail
- Wire the agents so they append to `output/audit_trail.json` as they run.
- For each agent-loop step, record enough detail to audit it later.
- Append to this file and do not wipe it on each run.

Harness doc: `output/harness.md`
- List each agent and each MCP tool, including the ones you add in this task.
- For each tool, say which table it uses.
- Add a short safety section covering:
  - the guardrails a real business would want when agents touch real customers and real money
  - limits that keep token use in check
- Let me review this file first before moving on.

README
- Update `mcp_server/README.md` so the tool list matches what exists now.
```

**Follow-up prompt**

```
ok i reviewed them it's good just compelte this pronblem
```

---

## Problem 6: Plan the three tickets

**Prompt I typed in**

```
problem 6: plan the three tickets
Before wiring the backend, write down what you expect the team to do on each open ticket. Let me review this first before moving on.

Build `output/desk_tickets.html`
- It should be a page I can double-click to open, with one tab per ticket: 101, 102, and 103.
- Also add empty `cash` and `reflection` tabs for later problems. Leave them blank or with a short "coming later" note for now.

Each ticket tab (101, 102, 103)
- Fill in an Expected section only.
- Leave room for an Actual section that you will fill in after you run the agents.

In each ticket's Expected section, suggest what I should write for these three items:
1. Who the boss should call first, and why. Answer this for me.
2. All the agent delegations you expect. This must not be "boss calls everyone."
3. Which MCP tools you expect that run to use.

Let me review your answers to these questions first as well.

Important
- Plans that send every specialist on every ticket score low.
- I will compare this plan to what actually happens when your agents resolve the 3 tickets, so be wise and specific about which agents and tools each ticket really needs.
```

**Follow-up prompt**

```
ok it's good!
```

---

## Problem 7: Backend routes

**Prompt I typed in**

```
problem7: backend routes
Your React frontend dashboard (the next problem) needs a backend it can call. In `backend/main.py`, use FastAPI and add routes that do the following:

1. Return the 3 tickets and whether each is open or resolved.
2. Take a ticket id and run your agent team on that ticket.
3. Return recent agent events (what each agent said and which tools they used) so the board can refresh.
4. Approve a payment or purchase after a human clicks approve. Agents only prepare the payment; this route is what actually changes cash.
5. Return the current checking balance from `cash_accounts`.
6. Reset the database to the original values when I want to try a fresh run.

Running the server
From the `backend/` folder, start the server in the terminal with:

uvicorn main:app --reload --port 8000

This turns on the backend at http://localhost:8000 so the frontend dashboard can call those routes.

Harness doc: `output/harness.md`
- List each route in one line: the URL and what it does.
```

---

## Problem 8: Agent dashboard

**Prompt I typed in**

```
problem 8: agent dashboard
Build the frontend dashboard in `frontend/` with React + Vite + TypeScript. The page should call the routes you built in problem 7.

At minimum, the board should:
- List all 3 tickets.
- Let me pick one ticket and start the agent team on it.
- Show each agent and what they are saying or doing while the ticket runs.
- Mark a ticket resolved when the run finishes.
- Show a short summary of what each agent did on that ticket.
- Let a human approve a pay or purchase when asked.
- Show the checking balance. It should drop after an approved pay.

Make the dashboard look good. Be creative with the layout and feel. This is a real desk people would want to sit at, so put thought into how it looks.

The UI should follow these 5 goals:

1. A warm, workshop-style look, not a generic SaaS dashboard. Think a cozy campus print shop: cream or paper-toned background, deep ink-blue text, and one bold accent color (say, a school-spirit orange) for actions and status. Use rounded cards with soft shadows and a slightly textured "desk surface" feel instead of flat white.

2. A three-zone desk layout.
   - Left rail: the ticket queue (101, 102, 103), each card showing an Open or Resolved badge.
   - Center stage: the selected ticket with its Start button and run status.
   - Right rail: the checking balance and pending approvals.
   Everything the person needs stays on one screen, with no page hopping.

3. Each agent as a visible "desk" with a personality. Five agent cards (Boss, Inventory, Accounting, Facilities, Customer Service), each with its own icon and color. A card is dimmed when idle, glows or pulses when working, and shows a live speech-bubble line of what it is saying plus small chips for the MCP tools it just used. A thin line or arrow animates between cards when one agent delegates to another, so you can watch the hand-offs.

4. An approval moment that feels weighty. When an agent prepares a payment or purchase, a distinct "needs your approval" card slides in with the amount, payee, and reason, plus clear Approve and Decline buttons. After approval, the checking balance animates down to the new number so the money change is obvious and trustworthy.

5. A clean wrap-up when a run finishes. The ticket badge flips from Open to Resolved with a small celebratory touch. A short summary panel appears with one line per agent that took part (what it did, which tools it used). Agents that weren't needed are marked "not called," so the plan versus reality is easy to read. Loading, empty, and error states all get friendly messages, so the desk never looks broken.

Backend connection
- Tell the frontend to talk to the backend at http://localhost:8000.
- On the backend, allow the Vite page origin (usually http://localhost:5173) with CORS so the browser is allowed to call those routes.

Running the board
Start the board in the terminal with:

npm run dev

This opens the React desk in the browser so I can pick tickets and watch the agents.

Design doc: `output/design.md`
Write `output/design.md` describing what you chose for the dashboard look and why. Cover:
- the layout
- how agents read differently from one another
- how resolved tickets and cash show up
- the creative choices that make it feel special and something a human would actually enjoy using
```

---

## Problem 9: Resolve the tickets

**Prompt I typed in**

```
problem9: resolve the tickets
Before testing the agents on a full run over the three tickets, reset the working database `data/campus_customs_new.db` again so you can start clean. Note the starting checking balance.

Then run all three tickets on the board (101, 102, 103) until each is resolved.

Actual sections: `output/desk_tickets.html`
- Open `output/desk_tickets.html` from problem 6.
- On each ticket tab, fill in the Actual section from this run: which agents worked, what they delegated, and which tools they used.
- Keep your Expected section so you can compare the two.

Cash tab: `output/desk_tickets.html`
On the cash tab of the same file, itemize the money:
1. The starting checking balance (after the reset).
2. For each ticket: how cash changed when that ticket resolved and why (which pay or purchase, and the dollar amount).
3. The ending checking balance. It must match `cash_accounts` in the working database.

Wrong cash math loses points even if the board shows every ticket resolved.

Also save:
- `output/resolved_tickets.json`: for each ticket, include the id, final status, short outcome, what each agent contributed, and any human approvals.
- `output/resolved_board.html`: a page I can double-click, with a screenshot of your React board for each resolved ticket (101, 102, and 103).

Audit trail and harness doc
- Append the real runs to `output/audit_trail.json`.
- Finish `output/harness.md` so it covers the tables, MCP tools, the five agents, API routes, the dashboard, and safety rules.
```

---

## Problem 10: Reflection

**Prompt I typed in**

```
problem 10: reflection
Open `output/desk_tickets.html` and fill in the reflection tab. Answer in your own vibe, and be detailed and thorough.

Answer these five questions:
1. How would you evaluate the performance of the agents on each ticket, and why?
2. For each ticket, how did the actual run compare to the expected plan you wrote earlier?
3. What would have been simpler as one agent with tools, and why?
4. Describe three new problems Campus Customs might face that this agent team could solve with the tools you built.
5. Describe three new problems Campus Customs might face that this agent team could not solve with the tools you built, and explain the tools and agents you would need to solve them.

Evidence and specificity
- Tie every answer to this app and the three tickets you ran (101, 102, 103).
- Use the ticket tabs and the cash tab on the same page as your evidence.
- Generic AI essays without Campus Customs details will score low.

Let me read the reflection first before moving on.
```

**Follow-up prompt**

```
use this instead
1. How the agents did

Ticket 101: The agents got the facts right. Size S of CC-TEE-WHITE is at 0, and invoice 501 is an overdue $840. No agent ever called pay, so checking only dropped from $3,400 to $2,560 once the shop owner approved the payment. What went wrong was after that. Customer service sent inventory back to the shelf a second time for no reason, and then the route marked the ticket resolved even though the note said to leave it open.

Ticket 102: The lease facts were right. The rent is $2,400, due 2026-09-02, and it isn't overdue as of the shop's today. Accounting read the live drawer, saw $2,560, which still covers the rent, and after the approval checking sat at $160. The weak spot is how many times the work went in circles. The boss, facilities, accounting, and customer service kept passing the same lease around. A second ask to accounting got refused, and two landlord drafts got written. That loop is what blew the token cap on the earlier attempts.

Ticket 103: This was the cleanest split of the three. Inventory said there were 8 on hand against the 20 the club wanted. Accounting held the price at the $22 unit cost floor and didn't make up a discount. No money moved, so checking stayed at $160. The miss is the resolved stamp. The agent's note says the club still has to name a price, and the route resolved the ticket anyway.

2. Plan versus what happened

Ticket 101: The main path matched my plan. Inventory went first, then accounting, then customer service. Facilities stayed out, and no agent called pay. Two things weren't in the plan. Inventory got a second lap, and the route resolved the ticket before the $840 approval happened.

Ticket 102: The first call matched, since facilities went first, and inventory stayed out. My plan said the boss wouldn't call accounting directly, but the boss did. My plan also assumed checking was still $3,400. The run correctly saw $2,560, because the tee bill from 101 had already been paid.

Ticket 103: The order matched, and so did the $22 floor. My plan said Bulldog Print Co was still blocked by invoice 501, but the run found them unblocked because the $840 had already posted. My plan said to leave the ticket open, and the agent's note said the same thing. The route resolved it anyway, with no approval after.

3. What one agent with tools could have done

Ticket 102 is the obvious one. It comes down to one lease row and one cash row. A single agent would have gotten the same $2,400 and the same $2,560 coverage without the refused handoff or the second draft. Ticket 101 didn't need check_stock twice. Ticket 103 didn't need read_pricing twice, and it didn't need a cash read at all, since $0 was leaving the drawer. The one piece I'd keep separate is the approve button. Agents still shouldn't call pay, and the cash tab only moves when the two signatures happen.

4. New problems this team could handle

A request for the blue hats. CC-HAT-BLUE has 40 in stock, so inventory plus a customer reply draft is enough, and checking stays at $160. An empty mug
```

---

## Problem 11: Submit to GitHub

**Prompt I typed in**

```
problem 11: submit to github
push the code to a public github repository so graders can clone it submit the repo url to canvas (give it to me i'll submit myself) and also put it in output/github_url.txt do not push the real .env to github repo do include both database files under data/ (the original and the working copy) so graders can run my app easily the expected file layout is per attached

README should explain copy original DB to the working copy when you need a clean run, start MCP server, start FastAPI backend, start the React board, reset the DB before a full three ticket runs
```
