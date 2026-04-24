import os
from dataclasses import dataclass


@dataclass
class Settings:
    # Flow2API remote_browser_api_key must match (Bearer)
    flow2api_bearer: str
    # WebSocket agents send this in register
    agent_device_token: str
    host: str
    port: int
    solve_timeout_seconds: int


def load_settings() -> Settings:
    raw_timeout = os.environ.get("SOLVE_TIMEOUT_SECONDS")
    t = 120
    if raw_timeout:
        t = max(5, int(raw_timeout))
    return Settings(
        flow2api_bearer=(os.environ.get("GATEWAY_FLOW2API_BEARER") or "").strip(),
        agent_device_token=(os.environ.get("GATEWAY_AGENT_DEVICE_TOKEN") or "").strip(),
        host=(os.environ.get("GATEWAY_HOST") or "0.0.0.0").strip() or "0.0.0.0",
        port=int(os.environ.get("GATEWAY_PORT") or "9080"),
        solve_timeout_seconds=t,
    )
