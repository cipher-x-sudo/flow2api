# Flow2API documentation

Reference material for HTTP endpoints and Pydantic models used by this project.

| Document | Description |
|----------|-------------|
| [customer-guide-video-jobs.md](./customer-guide-video-jobs.md) | **Customer-facing:** image & video model ids, payloads, responses, job lifecycle, video upscaling, admin “call mode”, checklist |
| [generation.md](./generation.md) | Generation API overview (routes, auth) |
| [generation-image.md](./generation-image.md) | Image model ids (`MODEL_CONFIG`, `type: "image"`) |
| [generation-video.md](./generation-video.md) | Video model ids (t2v / i2v / r2v) |
| [endpoints.md](./endpoints.md) | All API routes: public (OpenAI/Gemini), static, and admin/frontend |
| [models.md](./models.md) | Request/response and domain models (`src/core/models.py` and admin request bodies) |
| [agent-gateway.md](./agent-gateway.md) | Agent Gateway: Docker Compose, `remote_browser` URL, WebSocket agents, **HTTP and WebSocket request/response payloads** |

For an interactive schema, run the server and open `/openapi.json` or `/docs` (unless the host is restricted by `FLOW2API_API_ONLY_HOST`; see `ApiOnlyHostMiddleware` in `src/main.py`).
