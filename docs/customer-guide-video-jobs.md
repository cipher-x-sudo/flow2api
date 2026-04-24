# Image & video generation — customer guide

This document is for **end customers and integrators** using Flow2API as an OpenAI-compatible gateway. It covers **image** and **video** generation: model ids, the same OpenAI- and Gemini-style endpoints, JSON payloads, how responses are shaped, and how work completes on the server (including **video** upscaling and long-running jobs).

- **Image model list:** [section 2](#2-image-model-ids-catalog). **Video model list:** [section 3](#3-video-model-ids-catalog). **Aliases** (image only): [§2.1](#21-alias-and-generationconfig-image-only).  
- Per-field details (aspect ratio, image counts, video upscalers) are also in [generation-image.md](./generation-image.md) and [generation-video.md](./generation-video.md).  
- **Request and response examples:** [section 4](#4-request-format-headers-and-json-payloads) (including **§4.4** full response JSON for **image and video** generation, OpenAI and Gemini). Schemas: [models.md](./models.md) and [generation.md](./generation.md).

## Table of contents

1. [Endpoints for discovery, generation, and related URLs](#1-endpoints-for-discovery-generation-and-related-urls)
2. [Image model IDs (catalog)](#2-image-model-ids-catalog)  
   - [2.1 Alias and `generationConfig` (image only)](#21-alias-and-generationconfig-image-only)
3. [Video model IDs (catalog)](#3-video-model-ids-catalog) (subsections: t2v, i2v, r2v)
4. [Request format, headers, and JSON payloads](#4-request-format-headers-and-json-payloads) (subsections: 4.1–4.4 — headers, OpenAI, Gemini, **response payloads**)
5. [What you do as a client](#5-what-you-do-as-a-client)
6. [What happens inside the service (job handling)](#6-what-happens-inside-the-service-job-handling)
7. [Video upscaling (4K and 1080p models)](#7-video-upscaling-4k-and-1080p-models)
8. [Polling: two different meanings](#8-polling-two-different-meanings) (A: server status polling · B: admin call mode)
9. [Timeouts and retries (operator configuration)](#9-timeouts-and-retries-operator-configuration)
10. [Practical integration checklist](#10-practical-integration-checklist)
11. [Further reading in this repo](#11-further-reading-in-this-repo)

---

## 1. Endpoints for discovery, generation, and related URLs

**Base URL:** `https://<host>:<port>` (or the URL your operator gives you). All paths below are relative to that base.

**Authentication (generation and model lists):** `Authorization: Bearer <api_key>`, or header `x-goog-api-key: <api_key>`, or query `?key=<api_key>`. (There is no separate “admin” key for these routes; use the **API key** your operator provides.)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/models` | OpenAI-style catalog: `data[]` with `id`, `object`, `owned_by`, `description` (use `id` as `{model}`). |
| GET | `/v1/models/aliases` | Simplified **image** alias ids with `is_alias: true` (used with `generationConfig.imageConfig` — see [§2.1](#21-alias-and-generationconfig-image-only); not for video ids). |
| GET | `/v1beta/models` | Gemini-style `models[]` with `name` like `models/<id>`. |
| GET | `/models` | Same as `/v1beta/models`. |
| GET | `/v1beta/models/{model}` | Single model metadata; 404 if unknown. |
| GET | `/models/{model}` | Same as v1beta. |
| POST | `/v1/chat/completions` | **Primary OpenAI path:** JSON body with `"model"`, `messages` (or `contents`), optional `stream`, optional `generationConfig` (common for **image** alias resolution; see §2.1). |
| POST | `/v1beta/models/{model}:generateContent` | **Gemini path:** `contents` + optional `generationConfig` / `systemInstruction`. |
| POST | `/models/{model}:generateContent` | Same as v1beta. |
| POST | `/v1beta/models/{model}:streamGenerateContent` | Same body as `generateContent`; **SSE** response. |
| POST | `/models/{model}:streamGenerateContent` | Same as v1beta. |

**After generation (optional, depending on operator config):** If the service returns a URL under **`/tmp/<filename>`** on the same host, that is a **static file** served from the instance’s cache directory. Use a normal `GET` with no special header (or your browser) to download or play the file.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/tmp/*` | None required | Fetch cached media when the result URL points here. |
| GET | `/health` | None | Liveness: `backend_running`, `has_active_tokens`. |
| GET | `/openapi.json` | None | OpenAPI 3 spec for the app (if the deployment exposes it; `FLOW2API_API_ONLY_HOST` in some deployments allows only a subset of paths per hostname). |

> **No customer job-status API:** there is no `GET /v1/jobs/{id}` in stock Flow2API. Progress is the **open HTTP request** (or SSE stream) described later.

---

## 2. Image model IDs (catalog)

Use these exact strings for `{model}` or for `"model"` in `POST /v1/chat/completions`. All are **text-to-image** (and optional **image editing / conditioning** when you pass reference images in the last user message, same as multimodal format in [section 4](#4-request-format-headers-and-json-payloads)). Models ending in **`-2k`** / **`-4k`** select higher output resolution where the upstream model supports it.

**Gemini 2.5 Flash (GEM_PIX)**

- `gemini-2.5-flash-image-landscape`
- `gemini-2.5-flash-image-portrait`

**Gemini 3.0 Pro (GEM_PIX_2)** — include aspect; `-2k` / `-4k` suffixes are upsample tiers where listed.

- `gemini-3.0-pro-image-landscape`, `gemini-3.0-pro-image-portrait`, `gemini-3.0-pro-image-square`, `gemini-3.0-pro-image-four-three`, `gemini-3.0-pro-image-three-four`
- `gemini-3.0-pro-image-landscape-2k`, `gemini-3.0-pro-image-portrait-2k`, `gemini-3.0-pro-image-square-2k`, `gemini-3.0-pro-image-four-three-2k`, `gemini-3.0-pro-image-three-four-2k`
- `gemini-3.0-pro-image-landscape-4k`, `gemini-3.0-pro-image-portrait-4k`, `gemini-3.0-pro-image-square-4k`, `gemini-3.0-pro-image-four-three-4k`, `gemini-3.0-pro-image-three-four-4k`

**Imagen 4.0 (IMAGEN_3_5)**

- `imagen-4.0-generate-preview-landscape`
- `imagen-4.0-generate-preview-portrait`

**Gemini 3.1 Flash (NARWHAL)**

- `gemini-3.1-flash-image-landscape`, `gemini-3.1-flash-image-portrait`, `gemini-3.1-flash-image-square`, `gemini-3.1-flash-image-four-three`, `gemini-3.1-flash-image-three-four`
- `gemini-3.1-flash-image-landscape-2k`, `gemini-3.1-flash-image-portrait-2k`, `gemini-3.1-flash-image-square-2k`, `gemini-3.1-flash-image-four-three-2k`, `gemini-3.1-flash-image-three-four-2k`
- `gemini-3.1-flash-image-landscape-4k`, `gemini-3.1-flash-image-portrait-4k`, `gemini-3.1-flash-image-square-4k`, `gemini-3.1-flash-image-four-three-4k`, `gemini-3.1-flash-image-three-four-4k`

The authoritative set for a running server is **`GET /v1/models`** / **`GET /v1beta/models`** (filter or read descriptions for “Image” generation).

### 2.1 Alias and `generationConfig` (image only)

Instead of a long explicit id, you can send a **short base** model name and let the server resolve it using **`generationConfig.imageConfig`** (and optional quality/size), for example:

- `"model": "gemini-3.0-pro-image"` with `generationConfig.imageConfig.aspectRatio` such as `"16:9"`, `"9:16"`, `"1:1"`, `"4:3"`, `"3:4"` (or names like `landscape` / `portrait`).
- `imageConfig.imageSize`: `"2k"` or `"4k"` for models that support upsample (see resolver in the deployment).

`GET /v1/models/aliases` lists these base names. This alias flow applies to **image** models, not to **video** model ids in [section 3](#3-video-model-ids-catalog).

---

## 3. Video model IDs (catalog)

Use these exact strings for `{model}` in the paths above, or for `"model"` in `POST /v1/chat/completions`. Class meanings: **t2v** = text-only; **i2v** = first / first+last frame images; **r2v** = up to three reference images (0–3). Models whose id ends in **`_4k`** or **`_1080p`** also run a **separate upscaling** stage after the first video exists (longer end-to-end time).

### Text-to-video (t2v)

- `veo_3_1_t2v_fast_portrait`
- `veo_3_1_t2v_fast_landscape`
- `veo_3_1_t2v_fast_portrait_ultra`
- `veo_3_1_t2v_fast_ultra`
- `veo_3_1_t2v_fast_portrait_ultra_relaxed`
- `veo_3_1_t2v_fast_ultra_relaxed`
- `veo_3_1_t2v_portrait`
- `veo_3_1_t2v_landscape`
- `veo_3_1_t2v_lite_portrait`
- `veo_3_1_t2v_lite_landscape`
- `veo_3_1_t2v_fast_portrait_4k` (upscale 4K)
- `veo_3_1_t2v_fast_4k` (upscale 4K)
- `veo_3_1_t2v_fast_portrait_ultra_4k` (upscale 4K)
- `veo_3_1_t2v_fast_ultra_4k` (upscale 4K)
- `veo_3_1_t2v_fast_portrait_1080p` (upscale 1080p)
- `veo_3_1_t2v_fast_1080p` (upscale 1080p)
- `veo_3_1_t2v_fast_portrait_ultra_1080p` (upscale 1080p)
- `veo_3_1_t2v_fast_ultra_1080p` (upscale 1080p)

### Image / frame conditioning (i2v)

- `veo_3_1_i2v_s_fast_portrait_fl`
- `veo_3_1_i2v_s_fast_fl`
- `veo_3_1_i2v_s_fast_portrait_ultra_fl`
- `veo_3_1_i2v_s_fast_ultra_fl`
- `veo_3_1_i2v_s_fast_portrait_ultra_relaxed`
- `veo_3_1_i2v_s_fast_ultra_relaxed`
- `veo_3_1_i2v_s_portrait`
- `veo_3_1_i2v_s_landscape`
- `veo_3_1_i2v_lite_portrait`
- `veo_3_1_i2v_lite_landscape`
- `veo_3_1_interpolation_lite_portrait`
- `veo_3_1_interpolation_lite_landscape`
- `veo_3_1_i2v_s_fast_portrait_ultra_fl_4k` (upscale 4K)
- `veo_3_1_i2v_s_fast_ultra_fl_4k` (upscale 4K)
- `veo_3_1_i2v_s_fast_portrait_ultra_fl_1080p` (upscale 1080p)
- `veo_3_1_i2v_s_fast_ultra_fl_1080p` (upscale 1080p)

### Reference images (r2v)

- `veo_3_1_r2v_fast_portrait`
- `veo_3_1_r2v_fast`
- `veo_3_1_r2v_fast_portrait_ultra`
- `veo_3_1_r2v_fast_ultra`
- `veo_3_1_r2v_fast_portrait_ultra_relaxed`
- `veo_3_1_r2v_fast_ultra_relaxed`
- `veo_3_1_r2v_fast_portrait_ultra_4k` (upscale 4K)
- `veo_3_1_r2v_fast_ultra_4k` (upscale 4K)
- `veo_3_1_r2v_fast_portrait_ultra_1080p` (upscale 1080p)
- `veo_3_1_r2v_fast_ultra_1080p` (upscale 1080p)

The authoritative set for a running server is still **`GET /v1/models`** / **`GET /v1beta/models`**.

---

## 4. Request format, headers, and JSON payloads

### 4.1 HTTP headers (generation)

| Header | When | Value |
|--------|------|--------|
| `Content-Type` | `POST` with a JSON body | `application/json` |
| `Authorization` | If not using query `key` | `Bearer <api_key>` |
| `x-goog-api-key` | Optional alternative to `Authorization` | `<api_key>` |
| `Accept` | Optional | `application/json` (non-stream) or `text/event-stream` (stream) for awareness; the server still returns the correct type. |

**Query alternative:** you may call `POST /v1/chat/completions?key=<api_key>` (or add `key` to any generation URL) if your client cannot set headers.

The gateway **reads the prompt and images from the last user turn** in OpenAI `messages[]`, or from the last user `contents[]` block in Gemini format. `temperature`, `max_tokens`, and `generationConfig` are optional and only passed through when supported.

---

### 4.2 OpenAI style — `POST /v1/chat/completions`

**Body schema (relevant fields):**

```json
{
  "model": "<image-or-video-model-id>",
  "stream": false,
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 4096
}
```

- **`model`** (required): an **image** id from [section 2](#2-image-model-ids-catalog), a **video** id from [section 3](#3-video-model-ids-catalog), or an **image alias** base name with `generationConfig` (see [§2.1](#21-alias-and-generationconfig-image-only)).  
- **`messages`** (required unless you use native `contents`, see model docs): at least one message; the **last** user message must contain the **text** of your prompt (and any images, for multimodal).  
- **`content`** in that last message is either a **string** (text only) or an **array** of *parts* for multimodal (see below).  
- **`stream`** (optional, default `false`): `true` returns **SSE** (`data: {json}\n\n` lines, ending with `data: [DONE]\n\n`).  
- **`generationConfig`** (optional): for **image** models, use with alias ids or to pass `imageConfig` (`aspectRatio`, `imageSize`) as in §2.1.  
- Other fields: optional OpenAI pass-through; extra keys are allowed where the Pydantic model allows.

#### Text-only video (t2v)

```json
{
  "model": "veo_3_1_t2v_fast_landscape",
  "stream": false,
  "messages": [
    { "role": "user", "content": "A calm ocean at sunset, cinematic, slow pan." }
  ]
}
```

Do **not** attach images for t2v models; they are text-only on the wire.

#### Text-to-image (image model ids, prompt only)

```json
{
  "model": "gemini-3.0-pro-image-landscape",
  "stream": false,
  "messages": [
    { "role": "user", "content": "A red bicycle leaning on a stone wall, golden hour, photorealistic." }
  ]
}
```

#### Text-to-image using an **alias** + `generationConfig`

```json
{
  "model": "gemini-3.0-pro-image",
  "stream": false,
  "messages": [
    { "role": "user", "content": "Wide city skyline at night, long exposure car trails." }
  ],
  "generationConfig": {
    "imageConfig": {
      "aspectRatio": "16:9",
      "imageSize": "2k"
    }
  }
}
```

#### Image + reference (image models, last user message)

For img2img-style conditioning, add one or more `image_url` parts (after your text) in the **last** user message, same as for video i2v/r2v. Order and support depend on the upstream model.

```json
{
  "model": "gemini-3.1-flash-image-landscape",
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Keep the composition but shift to a watercolor look." },
        { "type": "image_url", "image_url": { "url": "https://example.com/reference.png" } }
      ]
    }
  ]
}
```

#### One or two frame images (i2v, video)

Put **all** text and **all** images in the **last** user message. For **one** start frame, use a single `image_url` part; for **start + end**, use two `image_url` parts **in order** (first = start, second = end).

```json
{
  "model": "veo_3_1_i2v_s_fast_fl",
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Smooth transition between the two frames, natural motion." },
        {
          "type": "image_url",
          "image_url": { "url": "https://example.com/start.png" }
        },
        {
          "type": "image_url",
          "image_url": { "url": "https://example.com/end.png" }
        }
      ]
    }
  ]
}
```

**Image `url` forms supported by the gateway:** public `http`/`https` links, or `data:image/...;base64,...`, or a prior result URL on this host under `/tmp/...` (if your operator exposes cached media).

#### Reference images (r2v, 0–3)

Same pattern: list `text` first (your prompt), then up to **three** `image_url` items in the order you want as references. Text-only is allowed for r2v (zero images) on supported models.

```json
{
  "model": "veo_3_1_r2v_fast",
  "stream": false,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Action scene matching the style of the references." },
        { "type": "image_url", "image_url": { "url": "https://example.com/ref-a.jpg" } },
        { "type": "image_url", "image_url": { "url": "https://example.com/ref-b.jpg" } }
      ]
    }
  ]
}
```

---

### 4.3 Gemini style — `POST .../models/{model}:generateContent` and `:streamGenerateContent`

The **`{model}`** segment in the path is the same id as in [section 2](#2-image-model-ids-catalog) (image) or [section 3](#3-video-model-ids-catalog) (video). The path **replaces** putting `model` in a top-level field (the body is Gemini-shaped).

**Body schema:**

```jsonc
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Your prompt" },
        { "inlineData": { "mimeType": "image/png", "data": "<base64 without data: prefix>" } }
      ]
    }
  ],
  "generationConfig": { },
  "systemInstruction": { "role": "user", "parts": [ { "text": "..." } ] }
}
```

- **`contents`** (required): non-empty array; the gateway resolves **text + images** from the **last** user `contents` block (or equivalent).  
- **`parts`:** each part is either `text`, or `inlineData` (base64 + `mimeType` for an image), or `fileData` with `fileUri` (and optional `mimeType`) pointing to `http`/`https` or `/tmp/...` cache URLs.  
- **`systemInstruction`:** optional; for media models the service may strip or sanitize large tool-style system prompts.  
- **`generationConfig`:** optional; use for **image** alias resolution (see [§2.1](#21-alias-and-generationconfig-image-only)). For **video** ids, usually omit unless your client always sends a shared envelope.

**Text-to-image (image model in path, text only):** use an image id from [section 2](#2-image-model-ids-catalog) in the URL.

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Product photo of a ceramic mug, soft box lighting, white background." }
      ]
    }
  ]
}
```

**Text-to-video (video model in path, text only) — t2v**

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Drone shot over a forest, morning mist." }
      ]
    }
  ]
}
```

**i2v with two inline images (start, then end) — video**

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "Interpolate between frames." },
        { "inlineData": { "mimeType": "image/jpeg", "data": "/9j/4AAQSkZJRg..." } },
        { "inlineData": { "mimeType": "image/jpeg", "data": "/9j/4AAQSkZJRg..." } }
      ]
    }
  ]
}
```

Use `POST` to the same path with `:streamGenerateContent` and an identical JSON body to receive **SSE** instead of a single JSON response.

---

### 4.4 Response payloads (generation) — image and video

The gateway adds a top-level **`url`** on success when it can parse a direct media link from the assistant message (same string as in the markdown / HTML), so clients can use **`url`** without parsing `content`.

#### OpenAI style — `POST /v1/chat/completions` (non-stream)

**HTTP 200, image** — `choices[0].message.content` is markdown; `model` in the response is the gateway label (`flow2api`), not your request’s model id.

```json
{
  "id": "chatcmpl-1730000000",
  "object": "chat.completion",
  "created": 1730000000,
  "model": "flow2api",
  "url": "https://example.com/tmp/abc123.png",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "![Generated Image](https://example.com/tmp/abc123.png)"
      },
      "finish_reason": "stop"
    }
  ]
}
```

**HTTP 200, video** — content wraps a `<video>` tag in a markdown HTML fence; **`url`** is still the playable link.

```json
{
  "id": "chatcmpl-1730000000",
  "object": "chat.completion",
  "created": 1730000000,
  "model": "flow2api",
  "url": "https://example.com/tmp/clip456.mp4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "```html\n<video src='https://example.com/tmp/clip456.mp4' controls></video>\n```"
      },
      "finish_reason": "stop"
    }
  ]
}
```

#### OpenAI style — `POST /v1/chat/completions` (stream, SSE)

Each line is `data: ` + JSON, except the terminator. **Progress** updates use `choices[0].delta.reasoning_content` (human-readable status in the gateway locale). The **last** media chunk uses `delta.content` and `finish_reason: "stop"` (no `reasoning_content` on that chunk).

**Mid-run (example progress):**

```text
data: {"id":"chatcmpl-1730000000","object":"chat.completion.chunk","created":1730000000,"model":"flow2api","choices":[{"index":0,"delta":{"reasoning_content":"视频生成中...\n\n"},"finish_reason":null}]}

```

**Final image (example):**

```text
data: {"id":"chatcmpl-1730000000","object":"chat.completion.chunk","created":1730000000,"model":"flow2api","choices":[{"index":0,"delta":{"content":"![Generated Image](https://example.com/tmp/abc123.png)"},"finish_reason":"stop"}]}

```

**Final video (example):** the final `content` is raw HTML (not the fenced block used in non-stream).

```text
data: {"id":"chatcmpl-1730000000","object":"chat.completion.chunk","created":1730000000,"model":"flow2api","choices":[{"index":0,"delta":{"content":"<video src='https://example.com/tmp/clip456.mp4' controls style='max-width:100%'></video>"},"finish_reason":"stop"}]}

```

**End of stream:**

```text
data: [DONE]

```

**HTTP error during stream** — a `data: ` line may contain a JSON object with a top-level **`error`** (same shape as non-stream below) instead of a normal chunk; then the stream may end.

#### OpenAI error shape (non-stream or final JSON)

```json
{
  "error": {
    "message": "Human-readable reason",
    "type": "server_error",
    "code": "generation_failed",
    "status_code": 502
  }
}
```

`type` is often `invalid_request_error` for 4xx-style failures. The HTTP status line matches `status_code` when the gateway sets it.

#### Gemini style — `POST .../models/{model}:generateContent` (non-stream, HTTP 200)

The body is **Gemini-shaped**: `candidates[0].content.parts[]` is derived from the same internal assistant string OpenAI mode uses. **Images** usually appear as `inlineData` (base64) after the gateway fetches the URL, or as `fileData` + `fileUri` when inlining is not used. **Video** is typically one `fileData` part with the video URL.

**Image (illustrative — parts may use `inlineData` or `fileData` depending on cache/upstream):**

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "iVBORw0KGgo..."
            }
          }
        ]
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "modelVersion": "gemini-3.0-pro-image-landscape"
}
```

**Video (typical `fileData` part):**

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "fileData": {
              "mimeType": "video/mp4",
              "fileUri": "https://example.com/tmp/clip456.mp4"
            }
          }
        ]
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "modelVersion": "veo_3_1_t2v_fast_landscape"
}
```

`modelVersion` is the **`{model}`** you used in the path. Multi-paragraph **progress** text in streaming can become **multiple** `text` parts in a single candidate when using Gemini stream conversion.

#### Gemini error shape (HTTP 4xx/5xx)

```json
{
  "error": {
    "code": 502,
    "message": "Human-readable reason",
    "status": "UNKNOWN"
  }
}
```

`status` follows the gateway’s Gemini compatibility map. Always read the JSON **body** on failure, not only the HTTP code.

---

## 5. What you do as a client

Call the **generation** endpoints in the table in [section 1](#1-endpoints-for-discovery-generation-and-related-urls) (usually `POST /v1/chat/completions` with the JSON in [section 4](#4-request-format-headers-and-json-payloads), or the Gemini `generateContent` / `streamGenerateContent` routes with the same payload rules).

**Streaming:** set `"stream": true` for chat completions, or use `:streamGenerateContent`. The connection stays open while the service works; you receive progress-style updates as server-sent events (SSE), then a final segment that includes the playable video (typically as an HTML fragment with a `<video src="...">` link in streaming mode).

**Non-streaming:** the same request **blocks** until the entire pipeline finishes (or fails). You do **not** receive a Google “operation id” in the public API to poll yourself—the gateway holds the work on this request.

---

## 6. What happens inside the service (job handling)

For **video**, the gateway performs an **asynchronous** workflow against Google’s Flow/VideoFX APIs, but that asynchrony is **internal** to the long-lived HTTP request:

1. **Submit** – The service starts a video job (text-only, start/end frame, or reference images, depending on the model) and receives one or more **operation** objects (task handles used only inside the gateway).
2. **Poll** – Until the job completes, fails, or hits a time limit, the service repeatedly calls Google’s **batch check status** API on a fixed interval (see below). This is **server-side polling**; you are not expected to call a separate “job status” URL.
3. **Result** – On success, the service obtains a **video URL** (and metadata). It may then optionally run **upscaling** (see section 7), cache the file locally if your operator enabled cache, and return a URL you can use (often a `/tmp/...` URL on the same host when caching is on).

For **image** generation, the gateway also finishes on the **same** request/response: there is no separate customer job id. Timelines are often shorter than for video; there is **no** second-stage **video** upsampler pipeline unless you chose a **video** model id with `_4k` / `_1080p` (see [section 7](#7-video-upscaling-4k-and-1080p-models)).

A row may also be written to the operator’s **internal** task log for their dashboard; that is not a public customer API.

**Upstream status values (conceptual):** the gateway treats a completed render as success when the upstream reports a successful media generation status, and failure when it reports failed or error-like states. Repeated **transport** errors while checking status are retried a few times; persistent failure returns an error response.

---

## 7. Video upscaling (4K and 1080p models)

Some model IDs are **“base + upscale”** presets. In configuration they include an `upsample` block: a target **resolution** (`4K` or `1080P` class) and a dedicated **upsampler** model key.

**Behavior:**

1. The service runs the **normal** video generation first and waits until that video exists.
2. It then **submits a second job** to upscale that asset (Google’s async upsample API).
3. It **polls again** (same style as step 2 in section 6) until the upscale finishes or times out. If the upscale cannot be created or fails, the implementation may **fall back to the pre-upscale (original) video** and still return a result when possible, with a notice in the stream if streaming is enabled.

Upscaling is **much slower** than a single-pass render—on the order of **many minutes** (plan for **up to ~30 minutes** in worst cases). The service increases its internal allowed poll window for upsample models so the job is less likely to abort too early.

**Which models:** any video model id whose name implies resolution upscaling (for example `*_4k`, `*_1080p` in the public model list) maps to this two-phase flow. The exact set is the `upsample` entries under `MODEL_CONFIG` in the deployment’s codebase; the authoritative list is `GET /v1/models` / `GET /v1beta/models` against your server.

---

## 8. Polling: two different meanings

### A) Server → Google (status polling, automatic)

The gateway polls Google on your behalf. Typical **operator** defaults (from example configuration) are on the order of:

- A few **seconds** between checks (`poll_interval`, e.g. 3 seconds).
- A **maximum number of checks** per phase (`max_poll_attempts`, e.g. 200 for the first phase).

For models that **include upscaling**, the service may allow **roughly three times** as many check attempts for the **combined** base + upscale phases, because upscale can run much longer.

**Implication for you:** use **generous HTTP client timeouts** (especially for non-streaming). Many minutes are normal for video, and more for 4K/1080p upscale paths. If your client times out, the work may still continue server-side, but you will not receive the result on that request.

### B) Admin: “call mode” / “polling” (which account to use)

In the **admin** API, `call_mode` (or the legacy `polling_mode` naming) is **not** the same as video job polling. It only controls how the service **picks which linked Google account (token) to use** for the next request when several are available, for example:

- **default** – load-aware, low-inflight preference (simplified: “use the least busy suitable account; some randomness”).
- **polling** – **round-robin** order between accounts to spread usage more evenly.

Customers **do not** configure this; the **operator** of your Flow2API instance does. It does not change the OpenAI request format.

---

## 9. Timeouts and retries (operator configuration)

- **Image / video generation timeouts** in admin (`image_timeout`, `video_timeout`, etc.) bound how long the product tries to complete work from the perspective of that configuration layer; combined with internal poll limits (especially for video), very long runs are still bounded.
- **Flow `max_retries`** and related settings apply to **individual HTTP calls** to Google (e.g. submit or status check), not to “infinite” retries of the whole job.
- If the final response is a **5xx** or a timeout, treat it as: possibly retry the **same** prompt in a new request, unless your policy forbids duplicate generations.

---

## 10. Practical integration checklist

1. **Use streaming in production** for long **video** (and optional **image**) runs when your stack supports SSE, so users see liveness and progress text instead of a silent hang.  
2. **Set client timeouts** above the expected worst case (image vs video; for video, base render + possible upscale + cache download).  
3. **Handle errors** in the response body (OpenAI-style `error` object or non-2xx for Gemini-shaped routes).  
4. For **video** **4K/1080p** upscale model IDs, set end-user expectations: **long waits** are normal.  
5. **Image aliases:** if you use base names, always send the intended **`generationConfig.imageConfig`** or you may get a default aspect/size.  
6. **Do not rely** on a customer-facing “get job by id” API in stock Flow2API—completion is the **response** to the same request (or the stream that ends with the asset).

---

## 11. Further reading in this repo

| Topic | Document |
|--------|----------|
| Video model IDs and types (t2v / i2v / r2v) | [generation-video.md](./generation-video.md) |
| Pydantic field names (`ChatCompletionRequest`, Gemini types) | [models.md](./models.md) |
| Image models | [generation-image.md](./generation-image.md) |
| Routes and auth | [generation.md](./generation.md) |
| All HTTP routes (including admin) | [endpoints.md](./endpoints.md) |

*Implementation reference for operators: `GenerationHandler` / `handle_generation` (image and video), `MODEL_CONFIG` in `src/services/generation_handler.py`; for **video** polling and upscale, `GenerationHandler._poll_video_result`, `FlowClient.check_video_status`, `FlowClient.upsample_video`; **image** alias resolution, `src/core/model_resolver.py`.*
