from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ev_backend import db
from ev_backend.agent import run_agent
from ev_backend.config import BACKEND_HOST, BACKEND_PORT, EV_ALLOWED_ORIGINS, OLLAMA_ENDPOINT
from ev_backend.ollama import chat as ollama_chat, get_status
from ev_backend.security import companion_auth
from ev_backend.speech import synthesize, transcribe_file, voices
from ev_backend.system import collect_metrics, list_processes
from ev_backend.tools import execute, preview_tool_call


db.init_db()
app = FastAPI(title="E.V. Local Backend", version="1.1.0")
app.middleware("http")(companion_auth)
app.add_middleware(
    CORSMiddleware,
    allow_origins=EV_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
)


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    model: str = ""
    language: str = "auto"
    history: list[dict[str, Any]] = Field(default_factory=list)
    approvedCalls: list[dict[str, Any]] = Field(default_factory=list)


class ToolExecuteRequest(BaseModel):
    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class SettingsUpdate(BaseModel):
    values: dict[str, Any]


class MemoryWrite(BaseModel):
    category: str
    key: str
    value: str
    importance: int = Field(default=5, ge=1, le=10)


class PermissionUpdate(BaseModel):
    actionType: str
    mode: str


class ScreenAnalyzeRequest(BaseModel):
    model: str = ""
    language: str = "auto"


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "E.V. Local Backend", "pid": os.getpid(), "networkMode": BACKEND_HOST != "127.0.0.1"}


@app.get("/api/system")
def system() -> dict[str, Any]:
    return collect_metrics()


@app.get("/api/processes")
def processes() -> list[dict[str, Any]]:
    return list_processes(50)


@app.get("/api/ollama/status")
def ollama_status() -> dict[str, Any]:
    settings = db.get_settings()
    return get_status(settings.get("ollamaEndpoint") or OLLAMA_ENDPOINT)


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return db.get_settings()


@app.put("/api/settings")
def update_settings(payload: SettingsUpdate) -> dict[str, Any]:
    return db.update_settings(payload.values)


@app.get("/api/messages")
def messages() -> list[dict[str, Any]]:
    return db.list_messages(120)


@app.delete("/api/messages")
def clear_messages() -> dict[str, bool]:
    db.clear_messages()
    return {"ok": True}


@app.get("/api/memories")
def memories(q: str = "") -> list[dict[str, Any]]:
    return db.list_memories(q, 200)


@app.post("/api/memories")
def create_memory(payload: MemoryWrite) -> dict[str, Any]:
    return db.upsert_memory(payload.category, payload.key, payload.value, payload.importance)


@app.delete("/api/memories/{memory_id}")
def remove_memory(memory_id: int) -> dict[str, bool]:
    db.delete_memory(memory_id)
    return {"ok": True}


@app.get("/api/permissions")
def permissions() -> dict[str, str]:
    result: dict[str, str] = {}
    for key in ["delete_file", "move_files", "install_software", "system_shutdown", "terminal_command", "write_text", "mouse_automation", "keyboard_automation", "send_message"]:
        result[key] = db.permission_mode(key)
    return result


@app.put("/api/permissions")
def update_permission(payload: PermissionUpdate) -> dict[str, bool]:
    if payload.mode not in {"block", "confirm", "always_allow"}:
        raise HTTPException(status_code=400, detail="Invalid permission mode")
    db.set_permission_mode(payload.actionType, payload.mode)
    return {"ok": True}


@app.post("/api/chat")
def chat(payload: ChatRequest) -> dict[str, Any]:
    settings = db.get_settings()
    model = payload.model or str(settings.get("model") or "").strip()
    if not model:
        status = get_status(str(settings.get("ollamaEndpoint") or OLLAMA_ENDPOINT))
        model = (status.get("runningModels") or status.get("models") or [""])[0]
    if not model:
        raise HTTPException(status_code=503, detail="No local Ollama model is configured or installed.")
    db.add_message("user", payload.text)
    history = payload.history[-30:]
    result = run_agent(str(settings.get("ollamaEndpoint") or OLLAMA_ENDPOINT), model, payload.text, payload.language, history, payload.approvedCalls)
    return {"content": result.content, "confirmations": result.confirmations, "events": result.events, "model": model}


@app.post("/api/tools/preview")
def preview_tool(payload: ToolExecuteRequest) -> dict[str, Any]:
    return preview_tool_call(payload.name, payload.args)


@app.post("/api/tools/execute")
def execute_tool(payload: ToolExecuteRequest) -> dict[str, Any]:
    return execute(payload.name, payload.args)


@app.get("/api/voices")
def get_voices() -> list[dict[str, str]]:
    return voices()


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = "auto", model: str = "small") -> dict[str, Any]:
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    fd, temp_name = tempfile.mkstemp(prefix="ev_stt_", suffix=suffix, dir=db.DB_PATH.parent / "tmp")
    os.close(fd)
    path = Path(temp_name)
    try:
        path.write_bytes(await audio.read())
        return transcribe_file(str(path), model, language)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        path.unlink(missing_ok=True)


@app.post("/api/speak")
def speak(text: str, voiceEngine: str = "auto", voice: str = "") -> FileResponse:
    try:
        output = synthesize(text, voiceEngine, voice)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return FileResponse(output, media_type="audio/wav", filename="ev-response.wav")


@app.post("/api/screen")
def screen() -> dict[str, Any]:
    return execute("screenshot", {})


@app.post("/api/screen/analyze")
def analyze_screen(payload: ScreenAnalyzeRequest) -> dict[str, Any]:
    settings = db.get_settings()
    model = payload.model or str(settings.get("visionModel") or "")
    if not model:
        raise HTTPException(status_code=400, detail="Select a local vision-capable Ollama model first.")
    screenshot = execute("screenshot", {})
    response = ollama_chat(
        str(settings.get("ollamaEndpoint") or OLLAMA_ENDPOINT),
        model,
        [{"role": "user", "content": f"Describe what is visible on my screen. Be concise and answer in {'Turkish' if payload.language == 'tr' else 'English'}.", "images": [screenshot["base64"]]}],
        tools=None,
    )
    return {"content": response.get("message", {}).get("content", ""), "model": model}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=False)
