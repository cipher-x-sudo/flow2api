# Endpoints

For **image and video generation**, see [generation.md](./generation.md) (shared routes) and the per-model lists in [generation-image.md](./generation-image.md) and [generation-video.md](./generation-video.md).

Base URL is your server host and port (for example `http://127.0.0.1:8000`).

## Authentication

| Audience | How |
|----------|-----|
| **Public API** (OpenAI/Gemini style routes below) | API key: `Authorization: Bearer <api_key>`, or header `x-goog-api-key: <api_key>`, or query `?key=<api_key>`. The key is stored in admin config. |
| **Admin / management API** (`/api/...` except where noted) | `Authorization: Bearer <admin_session_token>` after `POST /api/admin/login` (or alias `POST /api/login`). This is a **session token**, not the API key. |
| **Plugin** | `POST /api/plugin/update-token` uses the plugin `connection_token` (see plugin config) as `Authorization: Bearer <connection_token>`. |

---

## Public API (OpenAI- and Gemini-compatible)

Implemented in `src/api/routes.py`. All of these require the **public API key** unless noted.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/models` | OpenAI-style model list: `{ "object": "list", "data": [ { "id", "object", "owned_by", "description" } ] }` |
| GET | `/v1/models/aliases` | Same shape with alias models and `is_alias: true` for `generationConfig`-based resolution. |
| GET | `/v1beta/models` | Gemini-style list: `{ "models": [ { "name", "displayName", "description", "version", "supportedGenerationMethods", ... } ] }` |
| GET | `/models` | Alias of `/v1beta/models`. |
| GET | `/v1beta/models/{model}` | Single Gemini-style model resource; 404 with Gemini error body if unknown. |
| GET | `/models/{model}` | Alias of above. |
| POST | `/v1/chat/completions` | Unified generation: body is [ChatCompletionRequest](./models.md#chatcompletionrequest). Supports `stream` (SSE). |
| POST | `/v1beta/models/{model}:generateContent` | Gemini `generateContent`; body [GeminiGenerateContentRequest](./models.md#geminigeneratecontentrequest). |
| POST | `/models/{model}:generateContent` | Alias. |
| POST | `/v1beta/models/{model}:streamGenerateContent` | Gemini streaming (SSE). |
| POST | `/models/{model}:streamGenerateContent` | Alias. |

**Model IDs** are defined in `src/services/generation_handler.py` (`MODEL_CONFIG`); the authoritative list at runtime is from `GET /v1/models` / `GET /v1beta/models`.

---

## Static, health, and discovery

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness: `{ "backend_running", "has_active_tokens" }` |
| GET | `/openapi.json` | None | OpenAPI schema (see `main.py` for API-only host allowlist) |
| GET | `/tmp/{...}` | None | Serves files from the on-disk cache directory (static mount). |
| GET | `/assets/...` | None | Vite build assets when present. |
| GET | `/{path}` | None | SPA: serves `static/index.html` for non-API paths; `api/*` that miss handlers return 404 JSON. |

When `FLOW2API_API_ONLY_HOST` is set, only a subset of paths is allowed on that host (see `ApiOnlyHostMiddleware` in `src/main.py`); the web UI and most `/api` routes return 404 on that hostname.

---

## Admin and management API

Implemented in `src/api/admin.py`. Unless stated, routes require **admin Bearer session** token.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | None | Body [LoginRequest](./models.md#admin-request-models). Returns `{ "success", "token", "username" }`. |
| POST | `/api/admin/logout` | Admin | Invalidates session token. |
| POST | `/api/change-password` | Admin | [ChangePasswordRequest](./models.md#admin-request-models) — alias wired to same handler as below. |
| POST | `/api/admin/change-password` | Admin | Change password; clears all admin sessions. |

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Alias of `/api/admin/login`. |
| POST | `/api/logout` | Alias of `/api/admin/logout`. |

### Tokens

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tokens` | List tokens with stats (array of objects; see implementation for fields). |
| POST | `/api/tokens` | Add token — [AddTokenRequest](./models.md#admin-request-models). |
| PUT | `/api/tokens/{token_id}` | Update — [UpdateTokenRequest](./models.md#admin-request-models). |
| DELETE | `/api/tokens/{token_id}` | Delete token. |
| POST | `/api/tokens/{token_id}/enable` | Enable. |
| POST | `/api/tokens/{token_id}/disable` | Disable. |
| POST | `/api/tokens/{token_id}/refresh-credits` | Refresh credits. |
| POST | `/api/tokens/{token_id}/refresh-at` | Refresh access token from session token. |
| GET | `/api/tokens/{token_id}/projects` | List projects for token. |
| POST | `/api/tokens/{token_id}/projects` | Create project; body JSON: `title` (optional string), `set_as_current` (bool, default true). |
| POST | `/api/tokens/st2at` | [ST2ATRequest](./models.md#admin-request-models) — convert ST to AT only (no DB add). |
| POST | `/api/tokens/import` | [ImportTokensRequest](./models.md#admin-request-models) — bulk import. |

### Proxy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config/proxy` | Proxy config under `config`. |
| GET | `/api/proxy/config` | Same info, flatter keys (`proxy_enabled`, etc.). |
| POST | `/api/config/proxy` | [ProxyConfigRequest](./models.md#admin-request-models). |
| POST | `/api/proxy/config` | Same. |
| POST | `/api/proxy/test` | [ProxyTestRequest](./models.md#admin-request-models) — connectivity test. |

### Generation and call logic

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config/generation` | Image/video timeouts and `max_retries`. |
| POST | `/api/config/generation` | [GenerationConfigRequest](./models.md#admin-request-models). |
| GET | `/api/generation/timeout` | Alias of get generation config. |
| POST | `/api/generation/timeout` | Alias of update generation config. |
| GET | `/api/call-logic/config` | `call_mode`: `default` or `polling`. |
| POST | `/api/call-logic/config` | [CallLogicConfigRequest](./models.md#admin-request-models). |

### System, stats, logs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/system/info` | Token counts, version, etc. |
| GET | `/api/stats` | Dashboard stats. |
| GET | `/api/logs?limit=` | List logs; `limit` 1–100. |
| GET | `/api/logs/{log_id}` | Log detail with request/response bodies. |
| DELETE | `/api/logs` | Clear all logs. |

### Admin config, API key, debug

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/config` | Username, API key, error ban threshold, debug flag. |
| POST | `/api/admin/config` | [UpdateAdminConfigRequest](./models.md#admin-request-models) — e.g. `error_ban_threshold`. |
| POST | `/api/admin/password` | [ChangePasswordRequest](./models.md#admin-request-models). |
| POST | `/api/admin/apikey` | [UpdateAPIKeyRequest](./models.md#admin-request-models) — updates **public** API key. |
| POST | `/api/admin/debug` | [UpdateDebugConfigRequest](./models.md#admin-request-models). |

### Token refresh (UI compatibility)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/token-refresh/config` | AT auto-refresh is always reported enabled. |
| POST | `/api/token-refresh/enabled` | No-op compatibility endpoint. |

### File cache

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cache/config` | Enabled, timeout, base URL, effective URL. |
| GET | `/api/cache/stats` | Directory stats (requires file cache initialized). |
| GET | `/api/cache/files` | Gallery file list. |
| POST | `/api/cache/clear` | Clear all cached files. |
| POST | `/api/cache/enabled` | Body `{ "enabled": bool }`. |
| POST | `/api/cache/config` | Body: `enabled`, `timeout` (seconds, max 7 days), `base_url` (optional). |
| POST | `/api/cache/base-url` | Body `{ "base_url" }`. |

### Captcha

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/captcha/config` | Full captcha configuration object. |
| POST | `/api/captcha/config` | Large JSON body with `captcha_method`, solver keys, `remote_browser_*`, `browser_proxy_*`, `personal_*`, etc. (see `admin.py`). |
| POST | `/api/captcha/score-test` | **Disabled** — returns 403. |

### Chrome extension / plugin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/plugin/config` | Admin | Returns `connection_token`, `connection_url`, `auto_enable_on_update`. |
| POST | `/api/plugin/config` | Admin | Update plugin settings; may generate a new `connection_token`. |
| POST | `/api/plugin/update-token` | Plugin Bearer | Body `{ "session_token" }` — add or update account by email. |

---

## Source files

| File | Role |
|------|------|
| `src/api/routes.py` | Public OpenAI/Gemini routes |
| `src/api/admin.py` | Admin, health, cache, captcha, plugin |
| `src/main.py` | App, middleware, SPA catch-all, `/tmp` and `/assets` mounts |
