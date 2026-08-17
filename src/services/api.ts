import type { BackendConfig, ChatMessage, ComponentStatus, MemoryItem, OllamaStatus, SystemMetrics, ToolConfirmation } from '../types';

const DEFAULT_BASE = 'http://127.0.0.1:8765';
const FRONTEND_PORTS = new Set(['1420', '5173', '4173']);

function normalizeBase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function isFrontendUrl(value: string) {
  try {
    const url = new URL(value);
    const current = new URL(window.location.href);
    if (url.origin === current.origin) return true;
    return FRONTEND_PORTS.has(url.port);
  } catch {
    return false;
  }
}

function resolveBase() {
  const configured = normalizeBase((import.meta.env.VITE_EV_BACKEND_URL as string | undefined) || '');
  if (configured && !isFrontendUrl(configured)) return configured;

  const savedRaw = window.localStorage.getItem('ev.backendUrl') || '';
  const saved = normalizeBase(savedRaw);
  if (saved && !isFrontendUrl(saved)) return saved;
  if (savedRaw) window.localStorage.removeItem('ev.backendUrl');

  const queryRaw = new URLSearchParams(window.location.search).get('evBackend') || '';
  const query = normalizeBase(queryRaw);
  if (query && !isFrontendUrl(query)) {
    window.localStorage.setItem('ev.backendUrl', query);
    return query;
  }

  return DEFAULT_BASE;
}

let BASE = resolveBase();

export function setBackendUrl(url: string) {
  const normalized = normalizeBase(url);
  if (!normalized) {
    BASE = DEFAULT_BASE;
    window.localStorage.removeItem('ev.backendUrl');
    return;
  }
  if (isFrontendUrl(normalized)) throw new Error('The E.V. backend URL cannot point to the frontend server. Use http://127.0.0.1:8765.');
  BASE = normalized;
  window.localStorage.setItem('ev.backendUrl', BASE);
}

export function getBackendUrl() { return BASE; }

function authHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);
  const token = window.localStorage.getItem('ev.accessToken') || (import.meta.env.VITE_EV_ACCESS_TOKEN as string | undefined) || '';
  if (token.trim()) merged.set('Authorization', `Bearer ${token.trim()}`);
  return merged;
}

export function setAccessToken(token: string) {
  if (token.trim()) window.localStorage.setItem('ev.accessToken', token.trim());
  else window.localStorage.removeItem('ev.accessToken');
}

async function parseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  if (!contentType.toLowerCase().includes('application/json')) {
    if (/^<!doctype html/i.test(body) || /<html[\s>]/i.test(body)) {
      throw new Error(`E.V. backend URL is incorrect: ${BASE}. Received the frontend HTML page instead of JSON. The local backend should be ${DEFAULT_BASE}.`);
    }
    throw new Error(`E.V. backend returned ${contentType || 'a non-JSON response'} instead of JSON.`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('E.V. backend returned malformed JSON. Check the backend console for the original error.');
  }
}

export async function request<T>(path: string, init?: RequestInit, retries = 0): Promise<T> {
  let response: Response | undefined;
  let lastError: unknown;
  const requestInit = { ...init, headers: authHeaders(init?.headers) };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetch(`${BASE}${path}`, requestInit);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  if (!response) throw lastError instanceof Error ? lastError : new Error(`Cannot reach E.V. backend at ${BASE}.`);
  if (!response.ok) {
    const body = await response.text();
    let detail = body || response.statusText;
    try {
      const parsed = JSON.parse(body) as { detail?: unknown };
      if (typeof parsed.detail === 'string') detail = parsed.detail;
    } catch {}
    throw new Error(`${response.status} ${detail}`);
  }
  return parseJson<T>(response);
}

async function expectResponse(response: Response, fallback: string) {
  if (response.ok) return;
  const body = await response.text();
  if (/^<!doctype html/i.test(body) || /<html[\s>]/i.test(body)) {
    throw new Error(`E.V. backend URL is incorrect: ${BASE}. ${fallback}`);
  }
  throw new Error(body || `${response.status} ${response.statusText}`);
}

export const api = {
  health: () => request<{ ok: boolean }>('/health', undefined, 6),
  system: () => request<SystemMetrics>('/api/system', undefined, 2),
  ollama: () => request<OllamaStatus>('/api/ollama/status', undefined, 2),
  ensureOllama: () => request<OllamaStatus>('/api/ollama/ensure', { method: 'POST' }, 0),
  components: () => request<ComponentStatus>('/api/components/status', undefined, 2),
  settings: () => request<BackendConfig>('/api/settings', undefined, 2),
  updateSettings: (values: Partial<BackendConfig>) => request<BackendConfig>('/api/settings', { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ values }) }),
  messages: () => request<ChatMessage[]>('/api/messages', undefined, 1),
  clearMessages: () => request<{ ok: boolean }>('/api/messages', { method: 'DELETE' }),
  memories: (q = '') => request<MemoryItem[]>(`/api/memories?q=${encodeURIComponent(q)}`, undefined, 1),
  deleteMemory: (id: number) => request<{ ok: boolean }>(`/api/memories/${id}`, { method: 'DELETE' }),
  saveMemory: (memory: Pick<MemoryItem, 'category' | 'key' | 'value' | 'importance'>) => request<MemoryItem>('/api/memories', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(memory) }),
  chat: (payload: { text: string; model?: string; language?: string; history?: ChatMessage[]; approvedCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }> }) => request<{ content: string; confirmations: ToolConfirmation[]; events: string[]; model: string }>('/api/chat', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) }),
  previewTool: (name: string, args: Record<string, unknown>) => request<ToolConfirmation>('/api/tools/preview', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name, args }) }),
  executeTool: (name: string, args: Record<string, unknown>) => request<{ ok: boolean; [key: string]: unknown }>('/api/tools/execute', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name, args }) }),
  voices: () => request<Array<{ id: string; name: string }>>('/api/voices', undefined, 2),
  screen: () => request<{ ok: boolean; mime: string; base64: string }>('/api/screen', { method: 'POST' }),
  analyzeScreen: (model: string, language: string) => request<{ content: string; model: string }>('/api/screen/analyze', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ model, language }) }),
  speak: async (text: string, voiceEngine: string, voice: string) => {
    const response = await fetch(`${BASE}/api/speak?voiceEngine=${encodeURIComponent(voiceEngine)}&voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`, { method: 'POST', headers: authHeaders() });
    await expectResponse(response, 'Speech request reached the frontend instead of the local backend.');
    return URL.createObjectURL(await response.blob());
  },
  transcribe: async (blob: Blob, model: string, language: string) => {
    const form = new FormData();
    form.append('audio', blob, 'ev-input.webm');
    const response = await fetch(`${BASE}/api/transcribe?model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}`, { method: 'POST', headers: authHeaders(), body: form });
    await expectResponse(response, 'Speech-to-text request reached the frontend instead of the local backend.');
    return parseJson<{ text: string; language: string; duration: number; model: string }>(response);
  },
};
