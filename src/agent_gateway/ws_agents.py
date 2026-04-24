"""
WebSocket for outbound Node (or other) agents. First message must register the agent.
"""
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket
from fastapi import status as http_status

from .config import load_settings
from .state import registry

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/agents")
async def ws_agents(websocket: WebSocket) -> None:
    await websocket.accept()
    s = load_settings()
    if not s.agent_device_token:
        await websocket.close(code=4500, reason="GATEWAY_AGENT_DEVICE_TOKEN is not set")
        return

    first = await websocket.receive_text()
    try:
        data: dict[str, Any] = json.loads(first)
    except json.JSONDecodeError:
        await websocket.close(
            code=http_status.WS_1008_POLICY_VIOLATION,
            reason="expected JSON",
        )
        return

    if data.get("type") != "register":
        await websocket.close(
            code=http_status.WS_1008_POLICY_VIOLATION,
            reason="first message must be register",
        )
        return
    if data.get("device_token") != s.agent_device_token:
        await websocket.close(
            code=http_status.WS_1008_POLICY_VIOLATION,
            reason="invalid device token",
        )
        return

    raw_ids = data.get("token_ids") or []
    try:
        token_ids = [int(x) for x in raw_ids]
    except (TypeError, ValueError):
        await websocket.close(
            code=http_status.WS_1008_POLICY_VIOLATION,
            reason="token_ids must be a list of integers",
        )
        return

    if not token_ids:
        await websocket.close(
            code=http_status.WS_1008_POLICY_VIOLATION,
            reason="token_ids required",
        )
        return

    await registry.register_agent(websocket, token_ids)
    try:
        await websocket.send_json({"type": "registered", "token_ids": token_ids})
    except Exception:
        await registry.unregister(websocket)
        return

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg: dict[str, Any] = json.loads(text)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "invalid JSON"})
                continue

            mtype = msg.get("type")
            if mtype == "solve_result":
                job_id = msg.get("job_id")
                if not job_id:
                    continue
                await registry.complete_job(
                    str(job_id),
                    {
                        "token": msg.get("token"),
                        "session_id": msg.get("session_id"),
                        "fingerprint": msg.get("fingerprint"),
                    },
                )
            elif mtype == "solve_error":
                job_id = msg.get("job_id")
                err = str(msg.get("error") or "agent_error")
                if job_id:
                    await registry.fail_job(str(job_id), err)
            else:
                await websocket.send_json(
                    {"type": "error", "detail": f"unknown type {mtype!r}"}
                )
    except Exception:
        logger.exception("ws agent loop")
    finally:
        await registry.unregister(websocket)
