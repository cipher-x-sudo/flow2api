# Agent Gateway (remote_browser bridge)

When `captcha_method` is `remote_browser`, Flow2API calls `remote_browser_base_url` with Bearer `remote_browser_api_key` (see [`src/services/flow_client.py`](../src/services/flow_client.py)). The **agent gateway** implements that HTTP API and forwards work to PCs over **WebSocket** (`/ws/agents`), so home users do not expose inbound HTTP.

## Docker (gateway + Redis)

From the repo root:

```bash
cp .env.agent-gateway.example .env.agent-gateway
# Edit secrets, then:
docker compose -f docker-compose.yml -f docker-compose.agent-gateway.yml --env-file .env.agent-gateway up -d --build
```

Services:

- **agent-gateway** — port **9080** (host and container).
- **redis** — for future horizontal scale (Phase 3); the gateway MVP does not require Redis to function.

## Flow2API configuration

Set in the admin UI (Captcha / 打码) or database:

| Field | Value (Docker same network) |
|--------|-----------------------------|
| `captcha_method` | `remote_browser` |
| `remote_browser_base_url` | `http://agent-gateway:9080` |
| `remote_browser_api_key` | Same string as **`GATEWAY_FLOW2API_BEARER`** |
| `remote_browser_timeout` | ≤ gateway `SOLVE_TIMEOUT_SECONDS` (default 120) |

If Flow2API runs on the host and the gateway only in Docker, use `http://127.0.0.1:9080` instead.

## Environment variables (gateway container)

| Variable | Purpose |
|----------|---------|
| `GATEWAY_FLOW2API_BEARER` | Must match Flow2API `remote_browser_api_key`. |
| `GATEWAY_AGENT_DEVICE_TOKEN` | Secret agents send in the WebSocket `register` message. |
| `SOLVE_TIMEOUT_SECONDS` | Max wait for an agent to return a token (default 120). |
| `REDIS_URL` | Reserved for Phase 3 (optional). |

## Source layout

- [`src/agent_gateway/`](../src/agent_gateway/) — FastAPI app, HTTP routes, WebSocket handler, in-memory registry.

## Phase 2

A **Node.js** agent will connect to `ws://` or `wss://` and implement the protocol in [`src/agent_gateway/README.md`](../src/agent_gateway/README.md).
