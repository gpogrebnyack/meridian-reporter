"""Thin OpenRouter HTTP client with prompt-caching support.

OpenRouter exposes an OpenAI-compatible Chat Completions endpoint. For Anthropic
models we pass extended-thinking budgets via the top-level `reasoning` field,
and mark cache breakpoints inline via `cache_control: {"type": "ephemeral"}`
on specific content blocks. The `chat` method accepts either a plain string
system/user (auto-wrapped) or a list of content blocks for fine-grained control.
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any, Sequence

import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

ContentBlock = dict[str, Any]
MessageContent = str | Sequence[ContentBlock]


def supports_caching(model: str) -> bool:
    """True if the provider honours Anthropic-style `cache_control` breakpoints.

    OpenRouter passes these through for Anthropic models only; every other
    provider silently ignores the field and bills full input on every call.
    """
    slug = model.lower()
    return slug.startswith("anthropic/") or slug.startswith("claude-")


def text_block(text: str, *, cache: bool = False, ttl: str | None = None) -> ContentBlock:
    """Build a text content block, optionally marked as a cache breakpoint."""
    block: ContentBlock = {"type": "text", "text": text}
    if cache:
        cc: dict[str, Any] = {"type": "ephemeral"}
        if ttl:
            cc["ttl"] = ttl
        block["cache_control"] = cc
    return block


@dataclass
class ChatResult:
    content: str
    reasoning: str | None
    usage: dict[str, Any]
    raw: dict[str, Any]
    model: str


def _build_payload(
    *,
    model: str,
    system: MessageContent,
    user: MessageContent,
    max_tokens: int,
    temperature: float | None,
    reasoning_max_tokens: int | None,
    response_json: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if response_json:
        payload["response_format"] = {"type": "json_object"}
    if reasoning_max_tokens:
        payload["reasoning"] = {"max_tokens": reasoning_max_tokens}
    return payload


def _parse_response(data: dict[str, Any], fallback_model: str) -> ChatResult:
    msg = data["choices"][0]["message"]
    return ChatResult(
        content=msg.get("content") or "",
        reasoning=msg.get("reasoning"),
        usage=data.get("usage", {}),
        raw=data,
        model=data.get("model", fallback_model),
    )


class OpenRouterClient:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout: float = 600.0,
        app_title: str = "Meridian Autoreport",
        app_referer: str = "https://meridian.local",
    ):
        key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not key:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        self.api_key = key
        self.timeout = timeout
        self.app_title = app_title
        self.app_referer = app_referer

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.app_referer,
            "X-Title": self.app_title,
        }

    def chat(
        self,
        *,
        model: str,
        system: MessageContent,
        user: MessageContent,
        max_tokens: int = 16000,
        temperature: float | None = None,
        reasoning_max_tokens: int | None = None,
        response_json: bool = True,
    ) -> ChatResult:
        payload = _build_payload(
            model=model,
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            reasoning_max_tokens=reasoning_max_tokens,
            response_json=response_json,
        )
        with httpx.Client(timeout=self.timeout) as c:
            r = c.post(f"{OPENROUTER_BASE_URL}/chat/completions", headers=self.headers, json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"OpenRouter {r.status_code}: {r.text[:2000]}")
            return _parse_response(r.json(), model)

    async def chat_async(
        self,
        *,
        client: httpx.AsyncClient,
        model: str,
        system: MessageContent,
        user: MessageContent,
        max_tokens: int = 16000,
        temperature: float | None = None,
        reasoning_max_tokens: int | None = None,
        response_json: bool = True,
    ) -> ChatResult:
        payload = _build_payload(
            model=model,
            system=system,
            user=user,
            max_tokens=max_tokens,
            temperature=temperature,
            reasoning_max_tokens=reasoning_max_tokens,
            response_json=response_json,
        )
        r = await client.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=self.headers,
            json=payload,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"OpenRouter {r.status_code}: {r.text[:2000]}")
        return _parse_response(r.json(), model)


async def gather_limited(
    tasks: Sequence,
    *,
    concurrency: int = 5,
) -> list:
    """Run awaitables with a bounded concurrency semaphore; preserve order."""
    sem = asyncio.Semaphore(concurrency)

    async def wrap(coro):
        async with sem:
            return await coro

    return await asyncio.gather(*[wrap(t) for t in tasks])
