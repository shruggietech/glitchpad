import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createPerformanceSessions } from './performance-sessions';
import { ApplicationRecoveryBoundary } from './components/ApplicationRecoveryBoundary';
import './styles.css';

export const mount = (root: HTMLElement): void => {
  createRoot(root).render(
    <StrictMode>
      <ApplicationRecoveryBoundary>
        <App
          sessions={
            import.meta.env.VITE_GLITCHPAD_PERFORMANCE === '1'
              ? createPerformanceSessions()
              : []
          }
        />
      </ApplicationRecoveryBoundary>
    </StrictMode>,
  );
};
