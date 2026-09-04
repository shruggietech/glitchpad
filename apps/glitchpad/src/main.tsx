import './runtime-polyfills';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App, createPerformanceSessions } from './App';
import './styles.css';

const root = document.getElementById('root');

if (root === null) {
  throw new Error('Glitchpad could not find its application root.');
}

createRoot(root).render(
  <StrictMode>
    <App sessions={import.meta.env.VITE_GLITCHPAD_PERFORMANCE === '1' ? createPerformanceSessions() : undefined} />
  </StrictMode>,
);
