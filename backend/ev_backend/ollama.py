from __future__ import annotations

from typing import Any

import requests

from .config import SYSTEM_PROMPT


def get_status(endpoint: str) -> dict[str, Any]:
    base = endpoint.rstrip("/")
    try:
        tags = requests.get(f"{base}/api/tags", timeout=1.5)
        tags.raise_for_status()
        models = [m.get("name", "") for m in tags.json().get("models", []) if m.get("name")]
        running: list[str] = []
        try:
            ps = requests.get(f"{base}/api/ps", timeout=1.5)
            if ps.ok:
                running = [m.get("name", "") for m in ps.json().get("models", []) if m.get("name")]
        except requests.RequestException:
            pass
        return {
            "online": True,
            "endpoint": base,
            "modelCount": len(models),
            "models": models,
            "runningModels": running,
        }
    except (requests.RequestException, ValueError) as exc:
        return {
            "online": False,
            "endpoint": base,
            "modelCount": 0,
            "models": [],
            "runningModels": [],
            "error": str(exc),
        }


def chat(
    endpoint: str,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    images: list[str] | None = None,
) -> dict[str, Any]:
    request_messages = messages
    if not messages or messages[0].get("role") != "system":
        request_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]

    payload: dict[str, Any] = {
        "model": model,
        "stream": False,
        "messages": request_messages,
        "options": {"temperature": 0.4},
    }
    if tools:
        payload["tools"] = tools
    if images:
        payload["messages"][-1]["images"] = images
    response = requests.post(f"{endpoint.rstrip('/')}/api/chat", json=payload, timeout=180)
    response.raise_for_status()
    return response.json()
