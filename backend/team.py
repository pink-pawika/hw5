"""Campus Customs agent team.

Five PydanticAI agents share one MCP server and can delegate to each other.
Every model call uses gpt-6-luna through Portkey. Shop rows are read and
updated only by the MCP tools in mcp_server/server.py.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from portkey_ai import PORTKEY_GATEWAY_URL, createHeaders
from pydantic_ai import Agent, RunContext
from pydantic_ai.mcp import MCPToolset, StdioTransport
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
)
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from backend.audit import append_audit
from backend.models import AgentReport

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = Path(__file__).resolve().parent / "prompts"
MODEL_NAME = "gpt-6-luna"

# One shared budget for a boss run and every delegation under it.
TEAM_LIMITS = UsageLimits(
    request_limit=48,
    tool_calls_limit=80,
    total_tokens_limit=200_000,
)
MAX_DEPTH = 3

ROLES = ("boss", "inventory", "accounting", "facilities", "customer_service")


@dataclass
class ShopDeps:
    """Per-run state. Depth stops a delegation circle from running forever."""

    depth: int = 0
    asked: set[tuple[str, str]] | None = None


def load_prompt(role: str) -> str:
    path = PROMPTS / f"{role}.md"
    text = path.read_text()
    if not text.strip():
        raise RuntimeError(f"Prompt file is empty: {path}")
    return text


def build_model() -> OpenAIChatModel:
    """Portkey client for gpt-6-luna. The API key is never printed."""
    # Graders keep the key in this repo's .env. A local class folder may also
    # keep it one directory up. The first file that sets the key wins.
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env")
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is missing")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_GATEWAY_URL,
        default_headers=createHeaders(provider="openai"),
    )
    return OpenAIChatModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))


def shop_toolset() -> MCPToolset:
    """The Campus Customs MCP server. Agents do not open the database themselves."""
    python = ROOT / ".venv" / "bin" / "python"
    server = ROOT / "mcp_server" / "server.py"
    transport = StdioTransport(
        command=str(python),
        args=[str(server)],
        env={"FASTMCP_SHOW_SERVER_BANNER": "false"},
        cwd=str(ROOT),
    )
    # Cold start of the shop server can take longer than the 5-second default.
    return MCPToolset(transport, id="campus-customs", init_timeout=60)


def _jsonable(value: object) -> object:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return str(value)


def _audit_handler(agent_name: str):
    async def handler(ctx: RunContext[ShopDeps], events) -> None:
        async for event in events:
            depth = ctx.deps.depth if isinstance(ctx.deps, ShopDeps) else 0
            if isinstance(event, FunctionToolCallEvent):
                part = event.part
                append_audit(
                    agent_name,
                    "tool_call",
                    {
                        "tool_name": getattr(part, "tool_name", None),
                        "args": _jsonable(getattr(part, "args", None)),
                        "tool_call_id": getattr(part, "tool_call_id", None),
                    },
                    depth,
                )
            elif isinstance(event, FunctionToolResultEvent):
                part = event.part
                content = getattr(part, "content", None)
                append_audit(
                    agent_name,
                    "tool_result",
                    {
                        "tool_name": getattr(part, "tool_name", None),
                        "tool_call_id": getattr(part, "tool_call_id", None),
                        "content": _jsonable(content),
                    },
                    depth,
                )
            elif isinstance(event, FinalResultEvent):
                append_audit(
                    agent_name,
                    "final",
                    {"tool_name": event.tool_name},
                    depth,
                )

    return handler


def build_team() -> dict[str, Agent[ShopDeps, AgentReport]]:
    """Create the five agents and wire full delegation between them."""
    model = build_model()
    agents: dict[str, Agent[ShopDeps, AgentReport]] = {}
    for role in ROLES:
        agents[role] = Agent(
            model,
            name=role,
            deps_type=ShopDeps,
            output_type=AgentReport,
            instructions=load_prompt(role),
            toolsets=[shop_toolset()],
            model_settings={"openai_reasoning_effort": "none"},
            retries=1,
        )

    for source in ROLES:
        for target in ROLES:
            if source == target:
                continue
            _add_delegation(agents, source, target)
    return agents


def _add_delegation(
    agents: dict[str, Agent[ShopDeps, AgentReport]],
    source: str,
    target: str,
) -> None:
    async def ask(ctx: RunContext[ShopDeps], task: str) -> str:
        """Hand one task to a teammate and return that teammate's report."""
        depth = ctx.deps.depth if isinstance(ctx.deps, ShopDeps) else 0
        asked = ctx.deps.asked if isinstance(ctx.deps, ShopDeps) and ctx.deps.asked is not None else set()
        if isinstance(ctx.deps, ShopDeps) and ctx.deps.asked is None:
            ctx.deps.asked = asked
        pair = (source, target)
        if pair in asked:
            append_audit(
                source,
                "delegate_refused",
                {"target": target, "reason": "already asked", "task": task},
                depth,
            )
            return (
                "You already asked this teammate on this ticket. "
                "Finish with the facts you already have."
            )
        asked.add(pair)
        if depth >= MAX_DEPTH:
            append_audit(
                source,
                "delegate_refused",
                {"target": target, "reason": "depth limit", "task": task},
                depth,
            )
            return (
                "Delegation stopped because the depth limit was reached. "
                "Finish with the facts you already have."
            )
        append_audit(
            source,
            "delegate",
            {"target": target, "task": task},
            depth,
        )
        result = await agents[target].run(
            task,
            deps=ShopDeps(depth=depth + 1, asked=asked),
            usage=ctx.usage,
            usage_limits=TEAM_LIMITS,
            event_stream_handler=_audit_handler(target),
        )
        report = result.output.model_dump()
        append_audit(
            source,
            "delegate_result",
            {"target": target, "report": report},
            depth,
        )
        return result.output.model_dump_json()

    ask.__name__ = f"ask_{target}"
    ask.__doc__ = (
        f"Delegate one task to {target}. "
        "Pass the ticket id and the question. Use the report they return. "
        "Do not treat a depth-limit message as a shop fact."
    )
    agents[source].tool(ask)


async def run_agent(role: str, task: str, deps: ShopDeps | None = None) -> AgentReport:
    """Run one agent loop. Steps are appended to output/audit_trail.json."""
    if role not in ROLES:
        raise ValueError(f"Unknown role: {role}")
    state = deps or ShopDeps()
    agents = build_team()
    append_audit(role, "run_start", {"task": task}, state.depth)
    result = await agents[role].run(
        task,
        deps=state,
        usage_limits=TEAM_LIMITS,
        event_stream_handler=_audit_handler(role),
    )
    report = result.output
    append_audit(role, "run_end", {"report": report.model_dump()}, state.depth)
    return report


async def run_boss(task: str) -> AgentReport:
    """Start a shop task with the boss."""
    return await run_agent("boss", task)
