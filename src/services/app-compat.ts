import { setLegacyPermission } from './supabase-permissions';

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('/api/permissions') && (init?.method ?? 'GET').toUpperCase() === 'PUT') {
    try {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { actionType?: string; mode?: string } : {};
      if (body.actionType && body.mode) {
        await setLegacyPermission(body.actionType, body.mode);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ detail: error instanceof Error ? error.message : String(error) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return nativeFetch(input, init);
};
