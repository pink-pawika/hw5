# Campus Customs

A campus print shop run by five agents: boss, inventory, accounting, facilities, and customer service. They read a SQLite shop file through an MCP server, a FastAPI board runs them, and a React desk is where a person watches and approves payments.

Every model call uses `gpt-6-luna` through Portkey. The real key stays in `.env` and is not in this repo.

## Layout

```
hw5/
├── AI_prompts.md
├── requirements.txt
├── .env.example
├── .gitignore
├── .mcp.json
├── README.md
├── data/
│   ├── campus_customs.db
│   └── campus_customs_new.db
├── mcp_server/
│   ├── server.py
│   └── README.md
├── frontend/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── team.py
│   ├── audit.py
│   └── prompts/
└── output/
```

The MCP package is `mcp_server` so the backend can import it. Both database files are included. `data/campus_customs.db` is the original shop and is never written by the app. `data/campus_customs_new.db` is the working copy the MCP server and the API use. The copy in this repo is the shop after tickets 101, 102, and 103 were resolved, with checking at $160.

## Setup

Python 3.11 or newer. This project was run on Python 3.14.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Put your Portkey key in `.env` as `PORTKEY_API_KEY`. Do not commit that file.

```bash
cd frontend
npm install
```

## Clean database

Copy the original over the working copy whenever you want the shop back to its starting rows (checking $3,400, invoice 501 open, no payments, tickets open):

```bash
cp data/campus_customs.db data/campus_customs_new.db
```

Do this before a full run of all three tickets. If the API is already up, this does the same copy and leaves the audit trail in place:

```bash
curl -X POST http://localhost:8000/reset
```

## Start the MCP server

`mcp_server/server.py` speaks MCP over stdio and only opens `data/campus_customs_new.db`. The FastAPI team starts that process itself when a ticket runs, using `.venv/bin/python`.

To attach the same server in Cursor, this repo includes `.mcp.json` under the name `campus-customs`. Cursor reads a project server from `.cursor/mcp.json` if you use the IDE. Copy `.mcp.json` there and turn the server on. You can also start the process by hand. It waits on stdin, so a client has to speak MCP to it:

```bash
.venv/bin/python mcp_server/server.py
```

## Start the FastAPI backend

From `backend/`:

```bash
../.venv/bin/python -m uvicorn main:app --reload --port 8000
```

The board API is at http://localhost:8000. `POST /tickets/{id}/run` runs the team. `POST /approve` is the human click that actually changes cash. Agents prepare a payment. They do not pay it.

## Start the React board

From `frontend/`:

```bash
npm run dev
```

Open http://localhost:5173. The page calls http://localhost:8000. Pick a ticket and start the team from there.

## A full three-ticket run

1. Reset the working database from the original, with the `cp` command above or `POST /reset`.
2. Start the backend, which starts the MCP server when the team runs.
3. Start the React board.
4. Run tickets 101, 102, and 103 from the desk.
5. Approve a prepared invoice or rent payment on the desk if you want cash to move. Decline leaves the balance where it is.
