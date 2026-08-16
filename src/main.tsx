import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BootGate } from './components/BootGate';
import './styles/performance.css';
import './styles/mobile.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootGate>
      <App />
    </BootGate>
  </StrictMode>,
);
