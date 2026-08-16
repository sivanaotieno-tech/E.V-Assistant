import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './enter-system-fix';
import './styles/performance.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
