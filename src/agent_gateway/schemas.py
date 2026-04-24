"""
Message shapes for WebSocket agents (reference; validation can be tightened later).

MVP routing: in-memory map **token_id → WebSocket**. Persistent token↔device binding belongs
in a Dockerised DB or Redis in Phase 3.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field


class WsRegister(BaseModel):
    type: Literal["register"] = "register"
    device_token: str
    token_ids: list[int] = Field(min_length=1)


class WsSolveResult(BaseModel):
    type: Literal["solve_result"] = "solve_result"
    job_id: str
    token: str
    session_id: str
    fingerprint: Optional[dict] = None


class WsSolveError(BaseModel):
    type: Literal["solve_error"] = "solve_error"
    job_id: str
    error: str = "agent_error"
