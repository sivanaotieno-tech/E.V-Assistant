import { api } from './api';

let initialized = false;

/** Starts optional local services without blocking the HUD. */
export async function initializeLocalServices() {
  if (initialized) return;
  initialized = true;

  await new Promise((resolve) => window.setTimeout(resolve, 300));

  try {
    await api.ensureOllama();
  } catch {
    // E.V. remains usable in offline/local-backend mode.
  }
}
