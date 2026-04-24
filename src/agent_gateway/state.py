"""
In-memory MVP registry: token_id -> one active WebSocket (last registration wins).
Phase 3 can replace backing store with Redis (dockerised) without changing the HTTP contract.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Any, Optional

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class PendingSolve:
    job_id: str
    future: asyncio.Future[dict[str, Any]]
    token_id: Optional[int]
    project_id: str
    action: str
    agent_ws: WebSocket


class AgentRegistry:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        # int token_id -> WebSocket
        self._by_token: dict[int, WebSocket] = {}
        # ws id -> set of token_ids
        self._ws_tokens: dict[int, set[int]] = {}
        self._pending: dict[str, PendingSolve] = {}

    async def register_agent(self, ws: WebSocket, token_ids: list[int]) -> None:
        async with self._lock:
            wid = id(ws)
            for tid in token_ids:
                self._by_token[tid] = ws
            self._ws_tokens[wid] = set(token_ids)
            logger.info("agent registered token_ids=%s", token_ids)

    async def unregister(self, ws: WebSocket) -> None:
        async with self._lock:
            wid = id(ws)
            tids = self._ws_tokens.pop(wid, set())
            for tid in tids:
                if self._by_token.get(tid) is ws:
                    del self._by_token[tid]
            for jid, p in list(self._pending.items()):
                if p.agent_ws is ws and not p.future.done():
                    p.future.set_exception(RuntimeError("agent_disconnected"))
                    self._pending.pop(jid, None)
            logger.info("agent unregistered (token_ids were %s)", tids)

    def agent_for_token(self, token_id: Optional[int]) -> Optional[WebSocket]:
        if token_id is None:
            return None
        return self._by_token.get(int(token_id))

    async def dispatch_solve(
        self,
        token_id: Optional[int],
        project_id: str,
        action: str,
        timeout: float,
    ) -> dict[str, Any]:
        if token_id is None:
            raise ValueError("token_id is required for agent routing")
        job_id = str(uuid.uuid4())
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        p = PendingSolve(
            job_id=job_id,
            future=fut,
            token_id=int(token_id) if token_id is not None else None,
            project_id=project_id,
            action=action,
            agent_ws=ws,
        )
        async with self._lock:
            ws = self._by_token.get(int(token_id))
            if ws is None:
                raise LookupError("no_agent")
            self._pending[job_id] = p

        msg = {
            "type": "solve_job",
            "job_id": job_id,
            "project_id": project_id,
            "action": action,
            "token_id": int(token_id),
        }
        try:
            await ws.send_json(msg)
        except Exception as e:
            async with self._lock:
                self._pending.pop(job_id, None)
            if not fut.done():
                fut.set_exception(e)
            raise

        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            async with self._lock:
                self._pending.pop(job_id, None)
            raise
        except Exception:
            async with self._lock:
                self._pending.pop(job_id, None)
            raise

    async def complete_job(self, job_id: str, result: dict[str, Any]) -> bool:
        async with self._lock:
            p = self._pending.pop(job_id, None)
        if p is None:
            return False
        if not p.future.done():
            p.future.set_result(result)
        return True

    async def fail_job(self, job_id: str, err: str) -> bool:
        async with self._lock:
            p = self._pending.pop(job_id, None)
        if p is None:
            return False
        if not p.future.done():
            p.future.set_exception(RuntimeError(err))
        return True


registry = AgentRegistry()
