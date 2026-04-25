# Agent Client -> Gateway Connection Guide

This guide explains how a PC agent connects to the gateway WebSocket and exchanges captcha jobs/results in production.

## 1) Endpoint and transport

- WebSocket endpoint: `wss://<agents-host>/ws/agents`
- Example: `wss://agents.prismacreative.online/ws/agents`
- Public Cloudflare hostname should route to `http://agent-gateway:9080`

## 2) Auth modes (server-side)

Gateway supports `GATEWAY_AGENT_AUTH_MODE`:

- `legacy`: requires `device_token`
- `keygen`: requires `agent_token` (and in introspection mode also `agent_token_id`)
- `dual`: accepts either (migration mode)

Important trust boundary:

- Keygen secures WebSocket agent identity only.
- Gateway HTTP `/api/v1/*` still requires backend bearer (`GATEWAY_FLOW2API_BEARER`).

Configure in gateway env:

- `GATEWAY_AGENT_AUTH_MODE=legacy|keygen|dual`
- Legacy: `GATEWAY_AGENT_DEVICE_TOKEN`
- Keygen: `KEYGEN_VERIFY_MODE=jwt|introspection` and related `KEYGEN_*`

## 3) First frame: register

The first message after WebSocket connect must be JSON with `type: "register"`.

### Legacy register

```json
{
  "type": "register",
  "device_token": "<GATEWAY_AGENT_DEVICE_TOKEN>"
}
```

### Keygen register

```json
{
  "type": "register",
  "agent_token": "<keygen-token>",
  "agent_token_id": "<keygen-token-resource-uuid>"
}
```

Compatibility aliases accepted by gateway:

- `license_token` / `licenseToken` -> `agent_token`
- `license_token_id` / `licenseTokenId` -> `agent_token_id`

Notes:

- In `KEYGEN_VERIFY_MODE=introspection`, `agent_token_id` is required. Use the Keygen token UUID (e.g. `licenseTokenId`).

## 4) Registration response

On success gateway sends:

```json
{
  "type": "registered",
  "subject": "machine-1",
  "auth_method": "keygen"
}
```

## 5) Solve job flow

### Server -> client: `solve_job`

```json
{
  "type": "solve_job",
  "job_id": "uuid",
  "project_id": "flow-project-id",
  "action": "IMAGE_GENERATION"
}
```

### Client -> server: success

```json
{
  "type": "solve_result",
  "job_id": "same-job-id",
  "token": "<real-recaptcha-token>",
  "session_id": "<opaque-session-id>",
  "fingerprint": {
    "user_agent": "Mozilla/5.0 ..."
  }
}
```

### Client -> server: failure

```json
{
  "type": "solve_error",
  "job_id": "same-job-id",
  "error": "human-readable reason"
}
```

## 6) Connection failures and reasons

Common close reasons from gateway:

- `GATEWAY_AGENT_DEVICE_TOKEN is not set`
- `first message must be register`
- `expected JSON`
- `legacy mode requires device_token`
- `agent_token required`
- `agent_token_id required in introspection mode`
- `invalid device token`
- `agent auth failed: ...`

## 7) Minimal client checklist

- Connect to `wss://<host>/ws/agents`
- Send `register` as first frame
- In introspection mode, include both `agent_token` and `agent_token_id`
- Wait for `registered`
- Keep socket alive and read messages continuously
- On each `solve_job`, respond with `solve_result` or `solve_error`
- Reconnect with backoff on close/error

## 8) Quick test

Health:

```bash
curl -sS https://<agents-host>/health
```

Manual solve trigger (HTTP side; bearer is `GATEWAY_FLOW2API_BEARER`):

```bash
curl -sS -X POST "https://<agents-host>/api/v1/solve" \
  -H "Authorization: Bearer <GATEWAY_FLOW2API_BEARER>" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","action":"IMAGE_GENERATION"}'
```

## 9) User-side fallback example (headed server -> PC agent)

This is the practical behavior many users want:

- Flow2API runs with `captcha_method=browser` (server-side headed Playwright).
- `browser_fallback_to_remote_browser=true`.
- A PC agent is online and registered to gateway.

When server-side headed captcha fails, the same user can still solve via their own PC agent through gateway.

### Required settings

In **System Settings -> Captcha**:

- `captcha_method = browser`
- `browser_fallback_to_remote_browser = true`
- `remote_browser_base_url = http://agent-gateway:9080` (Docker internal)
- `remote_browser_api_key = <same as GATEWAY_FLOW2API_BEARER>`

On PC agent:

- Connect to `wss://<agents-host>/ws/agents`
- Register with valid Keygen credentials

### End-to-end flow

1. User sends a generation request to Flow2API.
2. Flow2API first tries headed browser captcha on the server/container (not on the user's PC).
3. Server-side headed solve fails (browser crash, timeout, missing dependency, reCAPTCHA evaluation/execute failure, etc.).
4. Flow2API fallback logic calls gateway `POST /api/v1/solve`.
5. Gateway dispatches `solve_job` to connected PC agent.
6. PC agent solves reCAPTCHA in its browser and sends `solve_result`.
7. Gateway returns token/session back to Flow2API.
8. Original generation request continues successfully.

### What the user should observe

- The API call may be slightly slower during fallback, but it should still complete.
- Logs should show browser fallback and then remote solve success.
- If no PC agent is online, fallback fails and request returns captcha error.

### Example scenario

Assume:

- Server-side headed browser (inside Flow2API host/container) fails due to local Chromium issue or reCAPTCHA evaluation failure
- A PC agent is online

Result:

- Instead of immediate request failure, gateway sends a `solve_job` to the PC.
- PC returns `solve_result` with token.
- Flow2API uses that token and continues generation.

### Disable behavior

Set `browser_fallback_to_remote_browser=false` if you want strict local-only browser behavior:

- server headed captcha fails -> request fails immediately
- no gateway fallback attempt
