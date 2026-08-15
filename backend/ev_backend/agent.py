from __future__ import annotations

import json
import re
from typing import Any

from . import db
from .config import SYSTEM_PROMPT
from .ollama import chat
from .tools import TOOLS, execute, ollama_tool_schemas, preview_tool_call


class AgentResult:
    def __init__(self, content: str, confirmations: list[dict[str, Any]], events: list[str]):
        self.content = content
        self.confirmations = confirmations
        self.events = events


def _extract_memory_intent(text: str) -> tuple[str, str] | None:
    patterns = [
        r"^remember(?: that)? (?:my )?favorite (?:language|programming language) is (.+)$",
        r"^remember(?: that)? (.+?) is (.+)$",
    ]
    low = text.strip()
    for pattern in patterns:
        match = re.match(pattern, low, re.IGNORECASE)
        if match:
            if pattern.startswith(r"^remember(?: that)? (?:my )?favorite"):
                return "PREFERENCE", "favorite_programming_language", match.group(1).strip()
            return "IMPORTANT_FACT", match.group(1).strip().replace(" ", "_"), match.group(2).strip()
    return None


def _memory_context() -> str:
    memories = db.list_memories("", 12)
    if not memories:
        return "No stored long-term memories are currently available."
    lines = [f"- [{m['category']}] {m['key']}: {m['value']}" for m in memories]
    return "Local long-term memory:\n" + "\n".join(lines)


def run_agent(endpoint: str, model: str, user_text: str, language: str, messages: list[dict[str, Any]], approved_calls: list[dict[str, Any]] | None = None, max_turns: int = 4) -> AgentResult:
    events: list[str] = []
    confirmations: list[dict[str, Any]] = []
    memory_intent = _extract_memory_intent(user_text)
    if memory_intent:
        category, key, value = memory_intent
        saved = db.upsert_memory(category, key, value, 8)
        events.append(f"memory        saved {saved['key']}")

    system_context = {
        "role": "system",
        "content": f"{SYSTEM_PROMPT}\n\n{_memory_context()}\n\nLanguage preference: {language}.",
    }
    local_messages = [system_context, *messages, {"role": "user", "content": user_text}]
    if approved_calls:
        for approved in approved_calls:
            local_messages.append({"role": "tool", "tool_name": approved["name"], "content": json.dumps(approved["result"], ensure_ascii=False)})

    for _ in range(max_turns):
        response = chat(endpoint, model, local_messages, tools=ollama_tool_schemas())
        message = response.get("message", {})
        content = str(message.get("content", "")).strip()
        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            if content:
                db.add_message("assistant", content)
            return AgentResult(content or "I'm ready.", confirmations, events)
        local_messages.append(message)
        events.append(f"tool           {len(tool_calls)} call(s) requested")
        for call in tool_calls:
            fn = call.get("function", {})
            name = str(fn.get("name", ""))
            args = fn.get("arguments") or {}
            if name not in TOOLS:
                local_messages.append({"role": "tool", "tool_name": name, "content": "Unknown tool. Do not retry it."})
                continue
            spec = TOOLS[name]
            mode = db.permission_mode(spec.permission)
            if spec.permission != "automatic":
                if mode == "block":
                    local_messages.append({"role": "tool", "tool_name": name, "content": "Blocked by E.V. permission policy."})
                    events.append(f"permission     blocked {name}")
                    continue
                if mode != "always_allow":
                    confirmations.append(preview_tool_call(name, args))
                    events.append(f"permission     confirmation required: {name}")
                    continue
            try:
                result = execute(name, args)
                local_messages.append({"role": "tool", "tool_name": name, "content": json.dumps(result, ensure_ascii=False)})
                events.append(f"tool           {name} completed")
            except Exception as exc:
                local_messages.append({"role": "tool", "tool_name": name, "content": json.dumps({"ok": False, "error": str(exc)})})
                events.append(f"tool           {name} failed")
        if confirmations:
            return AgentResult(content or "I need your approval before I perform that action.", confirmations, events)

    return AgentResult("I could not complete that request within the local tool cycle.", confirmations, events)
