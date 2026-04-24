# Models

Pydantic models are defined in `src/core/models.py` and admin request types in `src/api/admin.py`. Field types use Python 3.10+ annotations.

---

## Domain and configuration (`src/core/models.py`)

### Token

| Field | Type | Notes |
|-------|------|--------|
| `id` | `int` optional | |
| `st` | `str` | Session token |
| `at` | `str` optional | Access token (from ST) |
| `at_expires` | `datetime` optional | |
| `email` | `str` | |
| `name` | `str` optional | |
| `remark` | `str` optional | |
| `is_active` | `bool` | Default true |
| `created_at`, `last_used_at` | `datetime` optional | |
| `use_count` | `int` | |
| `credits` | `int` | |
| `user_paygate_tier` | `str` optional | |
| `current_project_id`, `current_project_name` | `str` optional | |
| `image_enabled`, `video_enabled` | `bool` | |
| `image_concurrency`, `video_concurrency` | `int` | `-1` = no limit |
| `captcha_proxy_url` | `str` optional | |
| `ban_reason`, `banned_at` | optional | 429 / rate limit tracking |

### Project

| Field | Type | Notes |
|-------|------|--------|
| `id` | `int` optional | |
| `project_id` | `str` | VideoFX project UUID |
| `token_id` | `int` | |
| `project_name` | `str` | |
| `tool_name` | `str` | Default `"PINHOLE"` |
| `is_active` | `bool` | |
| `created_at` | `datetime` optional | |

### TokenStats

| Field | Type |
|-------|------|
| `token_id` | `int` |
| `image_count`, `video_count`, `success_count`, `error_count` | `int` |
| `last_success_at`, `last_error_at` | `datetime` optional |
| `today_*` | today counters and `today_date` |
| `consecutive_error_count` | `int` |

### Task

| Field | Type | Notes |
|-------|------|--------|
| `task_id` | `str` | Flow operation name |
| `token_id` | `int` | |
| `model`, `prompt`, `status` | `str` | |
| `progress` | `int` 0–100 | |
| `result_urls` | `list[str]` optional | |
| `error_message`, `scene_id` | optional | |
| `created_at`, `completed_at` | optional | |

### RequestLog

| Field | Type |
|-------|------|
| `token_id` | `int` optional |
| `operation` | `str` |
| `request_body`, `response_body` | `str` optional |
| `status_code` | `int` |
| `duration` | `float` |
| `status_text` | `str` optional |
| `progress` | `int` |
| `created_at`, `updated_at` | optional |

### AdminConfig

| Field | Type | Notes |
|-------|------|--------|
| `id` | `int` | Default `1` |
| `username`, `password`, `api_key` | `str` | |
| `error_ban_threshold` | `int` | Consecutive errors before auto-disable |

### ProxyConfig

| Field | Type |
|-------|------|
| `id` | `int` |
| `enabled` | `bool` |
| `proxy_url` | `str` optional |
| `media_proxy_enabled` | `bool` |
| `media_proxy_url` | `str` optional |

### GenerationConfig

| Field | Type | Default (in model) |
|-------|------|----------------------|
| `image_timeout` | `int` | 300 s |
| `video_timeout` | `int` | 1500 s |
| `max_retries` | `int` | 3 |

### CallLogicConfig

| Field | Type |
|-------|------|
| `call_mode` | `str` e.g. `"default"` / `"polling"` |
| `polling_mode_enabled` | `bool` |

### CacheConfig

| Field | Type |
|-------|------|
| `cache_enabled` | `bool` |
| `cache_timeout` | `int` (seconds) |
| `cache_base_url` | `str` optional |

### DebugConfig

| Field | Type |
|-------|------|
| `enabled`, `log_requests`, `log_responses`, `mask_token` | `bool` |

### CaptchaConfig

| Field | Type | Notes |
|-------|------|--------|
| `captcha_method` | `str` | `yescaptcha`, `capmonster`, `ezcaptcha`, `capsolver`, `browser`, `personal`, `remote_browser` |
| `*_api_key`, `*_base_url` | | Per provider |
| `remote_browser_*` | | Remote headed service |
| `browser_proxy_enabled`, `browser_proxy_url` | | |
| `browser_captcha_page_url`, `browser_count` | | |
| `personal_project_pool_size`, `personal_max_resident_tabs`, `personal_idle_tab_ttl_seconds` | | |
| `website_key`, `page_action` | | reCAPTCHA-related defaults |

### PluginConfig

| Field | Type |
|-------|------|
| `connection_token` | `str` |
| `auto_enable_on_update` | `bool` |

---

## Public API request models

### ChatMessage

| Field | Type |
|-------|------|
| `role` | `str` |
| `content` | `str` **or** `list[dict]` (multimodal: `type` / `text` / `image_url`, etc.) |

### ImageConfig

| Field | Type | Notes |
|-------|------|--------|
| `aspectRatio` | `str` optional | e.g. `16:9` |
| `imageSize` | `str` optional | e.g. `2k`, `4k` |
| (extra) | | `ConfigDict(extra="allow")` |

### GenerationConfigParam

| Field | Type | Notes |
|-------|------|--------|
| `responseModalities` | `list[str]` optional | e.g. `["IMAGE", "TEXT"]` |
| `imageConfig` | `ImageConfig` optional | |
| (extra) | | `extra="allow"` for passthrough keys |

### GeminiInlineData, GeminiFileData, GeminiPart, GeminiContent

- **GeminiInlineData**: `mimeType`, `data` (base64)
- **GeminiFileData**: `fileUri`, `mimeType` optional
- **GeminiPart**: `text` OR `inlineData` OR `fileData`; extra allowed
- **GeminiContent**: `role` optional (`user` \| `model`), `parts: list[GeminiPart]`

### GeminiGenerateContentRequest

| Field | Type |
|-------|------|
| `contents` | `list[GeminiContent]` (required) |
| `generationConfig` | `GenerationConfigParam` optional |
| `systemInstruction` | `GeminiContent` optional |
| (extra) | `extra="allow"` |

### ChatCompletionRequest

| Field | Type | Notes |
|-------|------|--------|
| `model` | `str` (required) | |
| `messages` | `list[ChatMessage]` optional | OpenAI-style |
| `stream` | `bool` | Default false |
| `temperature`, `max_tokens` | optional | |
| `image`, `video` | `str` optional | Legacy; prefer multimodal `messages` |
| `generationConfig` | `GenerationConfigParam` optional | For alias resolution |
| `contents` | `list` optional | Native Gemini contents in OpenAI route |
| (extra) | | `extra="allow"` (e.g. `extra_body`) |

---

## Admin request models (`src/api/admin.py`)

### LoginRequest

| Field | Type |
|-------|------|
| `username` | `str` |
| `password` | `str` |

### AddTokenRequest

| Field | Type | Default |
|-------|------|---------|
| `st` | `str` | |
| `project_id`, `project_name`, `remark` | `str` optional | |
| `captcha_proxy_url` | `str` optional | |
| `image_enabled`, `video_enabled` | `bool` | true |
| `image_concurrency`, `video_concurrency` | `int` | -1 |

### UpdateTokenRequest

| Field | Type |
|-------|------|
| `st` | `str` (required) |
| `project_id`, `project_name`, `remark` | optional |
| `captcha_proxy_url` | optional |
| `image_enabled`, `video_enabled` | `bool` optional |
| `image_concurrency`, `video_concurrency` | `int` optional |

### ProxyConfigRequest

| Field | Type |
|-------|------|
| `proxy_enabled` | `bool` |
| `proxy_url` | `str` optional |
| `media_proxy_enabled`, `media_proxy_url` | optional |

### ProxyTestRequest

| Field | Type | Default |
|-------|------|---------|
| `proxy_url` | `str` | |
| `test_url` | `str` optional | `https://labs.google/` |
| `timeout_seconds` | `int` optional | 15 |

### CaptchaScoreTestRequest

Used by the disabled score-test route; fields are defaults for the old test flow.

### GenerationConfigRequest (admin)

| Field | Type |
|-------|------|
| `image_timeout`, `video_timeout`, `max_retries` | `int` optional |

### CallLogicConfigRequest

| Field | Type |
|-------|------|
| `call_mode` | `str` | `"default"` or `"polling"` |

### ChangePasswordRequest

| Field | Type |
|-------|------|
| `username` | `str` optional (change username) |
| `old_password` | `str` |
| `new_password` | `str` |

### UpdateAPIKeyRequest

| Field | Type |
|-------|------|
| `new_api_key` | `str` |

### UpdateDebugConfigRequest

| Field | Type |
|-------|------|
| `enabled` | `bool` |

### UpdateAdminConfigRequest

| Field | Type |
|-------|------|
| `error_ban_threshold` | `int` |

### ST2ATRequest

| Field | Type |
|-------|------|
| `st` | `str` |

### ImportTokenItem

| Field | Type | Default |
|-------|------|---------|
| `email` | `str` optional | |
| `access_token`, `session_token` | `str` optional | |
| `is_active` | `bool` | true |
| `captcha_proxy_url` | optional | |
| `image_enabled`, `video_enabled` | `bool` | true |
| `image_concurrency`, `video_concurrency` | `int` | -1 |

### ImportTokensRequest

| Field | Type |
|-------|------|
| `tokens` | `list[ImportTokenItem]` |

---

## Internal (not HTTP schema)

`src/api/routes.py` defines a **NormalizedGenerationRequest** dataclass (model, prompt, images, messages) for routing only; it is not part of the public OpenAPI body schema.

When documentation and code disagree, the implementation in `src/core/models.py` and `src/api/admin.py` is authoritative.
