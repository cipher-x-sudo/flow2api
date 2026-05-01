"""Prometheus monitoring helpers for Flow2API."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

_PROCESS_START_TIME = time.time()


def _to_utc_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _to_timestamp(value: Any) -> float:
    dt = _to_utc_datetime(value)
    if dt is None:
        return 0.0
    return float(dt.timestamp())


MAIN_REGISTRY = CollectorRegistry(auto_describe=True)

MAIN_UP = Gauge(
    "flow2api_up",
    "Whether the Flow2API service process is running.",
    registry=MAIN_REGISTRY,
)
MAIN_PROCESS_START_TIME = Gauge(
    "flow2api_process_start_time_seconds",
    "Flow2API process start time since unix epoch in seconds.",
    registry=MAIN_REGISTRY,
)

GENERATION_REQUESTS_TOTAL = Counter(
    "flow2api_generation_requests_total",
    "Logical generation request outcomes handled by Flow2API.",
    ["generation_type", "result"],
    registry=MAIN_REGISTRY,
)
GENERATION_DURATION_SECONDS = Histogram(
    "flow2api_generation_duration_seconds",
    "Generation request duration in seconds.",
    ["generation_type", "result"],
    registry=MAIN_REGISTRY,
)

TOKEN_REFRESH_TOTAL = Counter(
    "flow2api_token_refresh_total",
    "Token refresh outcomes by token kind.",
    ["kind", "result"],
    registry=MAIN_REGISTRY,
)

DASHBOARD_TOTAL_TOKENS = Gauge(
    "flow2api_dashboard_total_tokens",
    "Total tokens on dashboard.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_ACTIVE_TOKENS = Gauge(
    "flow2api_dashboard_active_tokens",
    "Active tokens on dashboard.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TOTAL_IMAGES = Gauge(
    "flow2api_dashboard_total_images",
    "Total image generations.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TOTAL_VIDEOS = Gauge(
    "flow2api_dashboard_total_videos",
    "Total video generations.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TOTAL_ERRORS = Gauge(
    "flow2api_dashboard_total_errors",
    "Total errors.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TODAY_IMAGES = Gauge(
    "flow2api_dashboard_today_images",
    "Today's image generations.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TODAY_VIDEOS = Gauge(
    "flow2api_dashboard_today_videos",
    "Today's video generations.",
    registry=MAIN_REGISTRY,
)
DASHBOARD_TODAY_ERRORS = Gauge(
    "flow2api_dashboard_today_errors",
    "Today's errors.",
    registry=MAIN_REGISTRY,
)

TOKEN_ACTIVE = Gauge(
    "flow2api_token_active",
    "Token active status (1 active, 0 inactive).",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_AT_PRESENT = Gauge(
    "flow2api_token_at_present",
    "Token AT present status (1 present, 0 empty).",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_AT_EXPIRES_TS = Gauge(
    "flow2api_token_at_expires_timestamp",
    "Token AT expiration unix timestamp in seconds.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_CREDITS = Gauge(
    "flow2api_token_credits",
    "Token credits.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_ERROR_COUNT = Gauge(
    "flow2api_token_error_count",
    "Token total error count.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_TODAY_ERROR_COUNT = Gauge(
    "flow2api_token_today_error_count",
    "Token today error count.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_CONSECUTIVE_ERROR_COUNT = Gauge(
    "flow2api_token_consecutive_error_count",
    "Token consecutive error count.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_LAST_USED_TS = Gauge(
    "flow2api_token_last_used_timestamp",
    "Token last used unix timestamp in seconds.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_LAST_ERROR_TS = Gauge(
    "flow2api_token_last_error_timestamp",
    "Token last error unix timestamp in seconds.",
    ["token_id"],
    registry=MAIN_REGISTRY,
)
TOKEN_BANNED_429 = Gauge(
    "flow2api_token_banned_429",
    "Token banned by 429 status (1 banned, 0 otherwise).",
    ["token_id"],
    registry=MAIN_REGISTRY,
)


def record_generation_result(generation_type: str, result: str, duration_seconds: Optional[float]) -> None:
    generation_type = (generation_type or "unknown").strip() or "unknown"
    result = (result or "unknown").strip() or "unknown"
    GENERATION_REQUESTS_TOTAL.labels(generation_type=generation_type, result=result).inc()
    if duration_seconds is not None:
        GENERATION_DURATION_SECONDS.labels(generation_type=generation_type, result=result).observe(
            max(0.0, float(duration_seconds))
        )


def record_token_refresh(kind: str, result: str) -> None:
    kind = (kind or "unknown").strip() or "unknown"
    result = (result or "unknown").strip() or "unknown"
    TOKEN_REFRESH_TOTAL.labels(kind=kind, result=result).inc()


async def render_main_metrics(db: Any, concurrency_manager: Optional[Any] = None) -> bytes:
    MAIN_UP.set(1.0)
    MAIN_PROCESS_START_TIME.set(_PROCESS_START_TIME)

    dashboard_stats = await db.get_dashboard_stats()
    DASHBOARD_TOTAL_TOKENS.set(float(dashboard_stats.get("total_tokens") or 0))
    DASHBOARD_ACTIVE_TOKENS.set(float(dashboard_stats.get("active_tokens") or 0))
    DASHBOARD_TOTAL_IMAGES.set(float(dashboard_stats.get("total_images") or 0))
    DASHBOARD_TOTAL_VIDEOS.set(float(dashboard_stats.get("total_videos") or 0))
    DASHBOARD_TOTAL_ERRORS.set(float(dashboard_stats.get("total_errors") or 0))
    DASHBOARD_TODAY_IMAGES.set(float(dashboard_stats.get("today_images") or 0))
    DASHBOARD_TODAY_VIDEOS.set(float(dashboard_stats.get("today_videos") or 0))
    DASHBOARD_TODAY_ERRORS.set(float(dashboard_stats.get("today_errors") or 0))

    rows = await db.get_all_tokens_with_stats()
    for row in rows:
        token_id = str(row.get("id") or "")
        if not token_id:
            continue

        is_active = bool(row.get("is_active"))
        at_value = str(row.get("at") or "").strip()
        at_expires = _to_utc_datetime(row.get("at_expires"))
        ban_reason = str(row.get("ban_reason") or "").strip() or "none"

        TOKEN_ACTIVE.labels(token_id=token_id).set(1.0 if is_active else 0.0)
        TOKEN_AT_PRESENT.labels(token_id=token_id).set(1.0 if at_value else 0.0)
        TOKEN_AT_EXPIRES_TS.labels(token_id=token_id).set(float(at_expires.timestamp()) if at_expires else 0.0)
        TOKEN_CREDITS.labels(token_id=token_id).set(float(row.get("credits") or 0))
        TOKEN_ERROR_COUNT.labels(token_id=token_id).set(float(row.get("error_count") or 0))
        TOKEN_TODAY_ERROR_COUNT.labels(token_id=token_id).set(float(row.get("today_error_count") or 0))
        TOKEN_CONSECUTIVE_ERROR_COUNT.labels(token_id=token_id).set(float(row.get("consecutive_error_count") or 0))
        TOKEN_LAST_USED_TS.labels(token_id=token_id).set(_to_timestamp(row.get("last_used_at")))
        TOKEN_LAST_ERROR_TS.labels(token_id=token_id).set(_to_timestamp(row.get("last_error_at")))
        TOKEN_BANNED_429.labels(token_id=token_id).set(
            1.0 if ((not is_active) and ban_reason == "429_rate_limit") else 0.0
        )

    # Keep this optional and defensive: different branches can have different APIs.
    if concurrency_manager is not None and hasattr(concurrency_manager, "collect_metrics"):
        try:
            await concurrency_manager.collect_metrics()
        except Exception:
            pass

    return generate_latest(MAIN_REGISTRY)


async def build_public_health_snapshot(db: Any) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    rows = await db.get_all_tokens_with_stats()

    active_tokens = 0
    with_at = 0
    expiring_within_1h = 0
    expired = 0
    banned_429 = 0

    for row in rows:
        is_active = bool(row.get("is_active"))
        if is_active:
            active_tokens += 1

        if str(row.get("at") or "").strip():
            with_at += 1

        at_expires = _to_utc_datetime(row.get("at_expires"))
        if at_expires is not None:
            if at_expires <= now:
                expired += 1
            elif (at_expires - now).total_seconds() < 3600:
                expiring_within_1h += 1

        if (not is_active) and str(row.get("ban_reason") or "").strip() == "429_rate_limit":
            banned_429 += 1

    return {
        "backend_running": True,
        "has_active_tokens": active_tokens > 0,
        "active_tokens": active_tokens,
        "tokens_with_at": with_at,
        "tokens_expiring_within_1h": expiring_within_1h,
        "tokens_expired": expired,
        "tokens_banned_429": banned_429,
    }
