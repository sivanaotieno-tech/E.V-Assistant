import type { PropsWithChildren } from 'react';

const STORAGE_KEY = 'ev.firstRunComplete';

export function BootGate({ children }: PropsWithChildren) {
  const complete = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    window.location.reload();
  };

  if (window.localStorage.getItem(STORAGE_KEY) === '1') {
    return <>{children}</>;
  }

  return (
    <div className="overlay first-run boot-gate" style={{ zIndex: 9999 }}>
      <div className="first-run-box">
        <div className="first-run-logo">E.V.</div>
        <div className="first-run-title">ENHANCED VOICE SYSTEM</div>
        <div className="first-run-subtitle">LOCAL AI • VOICE • MEMORY • CONTROL</div>
        <div className="boot-sequence">
          <span>[ OK ] DESKTOP RUNTIME</span>
          <span>[ OK ] LOCAL STORAGE</span>
          <span>[ OK ] PERMISSION BOUNDARY</span>
          <span>[ WAIT ] LOCAL AI SERVICES</span>
          <span>[ OK ] E.V. CORE UI</span>
        </div>
        <p>Enter E.V. now. Ollama, Whisper and the local backend can finish initializing in the background.</p>
        <button type="button" className="hud-button primary large boot-enter" onClick={complete}>
          ENTER E.V. SYSTEM
        </button>
      </div>
    </div>
  );
}
