"""Data types for the Campus Customs agent team.

These shapes are what the agents return and what a run records. Shop rows
themselves stay in the database. Tools read them through the MCP server.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AgentReport(BaseModel):
    """One agent's reply at the end of its loop."""

    summary: str
    facts: list[str] = Field(default_factory=list)
    waiting_on_human: bool = False
    draft_for_the_board: str | None = None


class AuditStep(BaseModel):
    """One agent-loop step appended to output/audit_trail.json."""

    recorded_at: str
    agent: str
    kind: str
    depth: int = 0
    detail: dict
