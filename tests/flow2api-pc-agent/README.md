# Flow2API PC captcha agent (Node + Playwright)

Long-running process on a **user PC**:

1. Connects to the **agent gateway** with `wss://…/ws/agents` and the **device** secret.
2. On each `solve_job`, opens **Chromium** (persistent profile) and runs **reCAPTCHA Enterprise** the same way Flow2API’s in-box **browser** mode does.

### Default `startUrl` (`…/auth/providers`)

That URL returns **JSON** in a normal navigation, not an HTML page with reCAPTCHA. Flow2API’s Python code uses a **stub**: it intercepts the request and returns minimal **HTML** that loads `enterprise.js` (see `browser_captcha.py` / `use_stub`). This agent does the **same** so `grecaptcha.enterprise.execute(websiteKey, { action })` can run. If you set a **different** `startUrl` (a real Flow tool page), the agent navigates there without the stub (you may need to be logged in in the profile).

Then: real `token` + new `session_id` + `fingerprint` with `user_agent`.

**Not a wiring test:** this replaces the placeholder `tools/agent-gateway-test/test-agent.mjs` when you need real captcha.

## 1) Install

```bash
cd tools/flow2api-pc-agent
npm install
npx playwright install chromium
```

## 2) Device token (required)

Must match the server’s **`GATEWAY_AGENT_DEVICE_TOKEN`** (in Docker `.env` for `agent-gateway`).

**Option A — environment (no file edit):**

```powershell
# PowerShell
$env:GATEWAY_AGENT_DEVICE_TOKEN = "<paste from server .env>"
$env:AGENT_GATEWAY_WSS = "wss://agents.yourdomain.com/ws/agents"   # optional; see FILE_CONFIG
npm start
```

```bash
export GATEWAY_AGENT_DEVICE_TOKEN="..."
# optional: export AGENT_GATEWAY_WSS=...  export AGENT_TOKEN_IDS=1,2
npm start
```

**Option B — edit `agent.mjs`:** set `FILE_CONFIG.deviceToken` to the same value.

| Field in `FILE_CONFIG` | Env override | Meaning |
|------------------------|----------------|--------|
| `wss` | `AGENT_GATEWAY_WSS` | Public WebSocket URL |
| `deviceToken` | `GATEWAY_AGENT_DEVICE_TOKEN` | WebSocket **device** secret (not the Flow2API HTTP bearer) |
| `tokenIds` | `AGENT_TOKEN_IDS` (e.g. `1` or `1,2`) | Flow2API token **row ids** (admin) this PC serves |
| `userDataDir` | — | Chromium profile; log in to Google/Flow on first run if needed |
| `startUrl` / `websiteKey` | — | Should match Flow2API captcha **browser** settings |
| `headless` | — | `false` recommended |

## 3) Run

```bash
npm start
```

Leave the process running. On first launch, sign in in the profile if prompted.

## 4) Server side

- Flow2API: `remote_browser`, `http://agent-gateway:9080`, and HTTP bearer = `GATEWAY_FLOW2API_BEARER`.
- Docker: `agent-gateway` with both env vars set. Cloudflare: `agents.…` → `http://agent-gateway:9080`.

## Troubleshooting

- **`grecaptcha` not ready` / timeouts:** set `startUrl` and `websiteKey` to match your Flow2API **System settings** captcha section, or complete login in the persistent profile.
- **Multiple solves:** jobs are processed **one at a time** in this tool (simple queue).
- **Windows:** `userDataDir` is a normal path under this folder; `.pc-agent-profile` is gitignored.
