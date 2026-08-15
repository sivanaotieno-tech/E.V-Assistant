import type { BackendConfig, ChatMessage, MemoryItem, OllamaStatus, SystemMetrics, ToolConfirmation } from '../types';

const BASE = 'http://127.0.0.1:8765';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    let detail = body || response.statusText;
    try { detail = JSON.parse(body).detail ?? detail; } catch { /* body may be plain text */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  system: () => request<SystemMetrics>('/api/system'),
  ollama: () => request<OllamaStatus>('/api/ollama/status'),
  settings: () => request<BackendConfig>('/api/settings'),
  updateSettings: (values: Partial<BackendConfig>) => request<BackendConfig>('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }),
  messages: () => request<ChatMessage[]>('/api/messages'),
  clearMessages: () => request<{ ok: boolean }>('/api/messages', { method: 'DELETE' }),
  memories: (q = '') => request<MemoryItem[]>(`/api/memories?q=${encodeURIComponent(q)}`),
  deleteMemory: (id: number) => request<{ ok: boolean }>(`/api/memories/${id}`, { method: 'DELETE' }),
  saveMemory: (memory: Pick<MemoryItem, 'category' | 'key' | 'value' | 'importance'>) => request<MemoryItem>('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(memory) }),
  chat: (payload: { text: string; model?: string; language?: string; history?: ChatMessage[]; approvedCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }> }) => request<{ content: string; confirmations: ToolConfirmation[]; events: string[]; model: string }>('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  previewTool: (name: string, args: Record<string, unknown>) => request<ToolConfirmation>('/api/tools/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args }) }),
  executeTool: (name: string, args: Record<string, unknown>) => request<{ ok: boolean; [key: string]: unknown }>('/api/tools/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, args }) }),
  voices: () => request<Array<{ id: string; name: string }>>('/api/voices'),
  screen: () => request<{ ok: boolean; mime: string; base64: string }>('/api/screen', { method: 'POST' }),
  analyzeScreen: (model: string, language: string) => request<{ content: string; model: string }>('/api/screen/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, language }) }),
  speak: async (text: string, voiceEngine: string, voice: string) => {
    const response = await fetch(`${BASE}/api/speak?voiceEngine=${encodeURIComponent(voiceEngine)}&voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`, { method: 'POST' });
    if (!response.ok) throw new Error(await response.text());
    return URL.createObjectURL(await response.blob());
  },
  transcribe: async (blob: Blob, model: string, language: string) => {
    const form = new FormData();
    form.append('audio', blob, 'ev-input.webm');
    const response = await fetch(`${BASE}/api/transcribe?model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ text: string; language: string; duration: number; model: string }>;
  },
};
