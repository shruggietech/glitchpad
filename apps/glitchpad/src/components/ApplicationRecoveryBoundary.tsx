import {
  consumeRecoveryProbe,
  installRecoveryProbeListener,
} from '../domain/recovery-probes';
import { Component, type ReactNode } from 'react';
import {
  emitRecoveryFailure,
  reportRecoveryFailure,
  requestApplicationRestart,
  type RecoveryFailureReporter,
} from '../bootstrap-recovery';

interface ApplicationRecoveryBoundaryProps {
  children: ReactNode;
  onFailure?: RecoveryFailureReporter;
  restart?: () => Promise<void>;
}
interface ApplicationRecoveryBoundaryState {
  failed: boolean;
  pending: boolean;
  restartFailed: boolean;
  probeFailure: boolean;
}

export class ApplicationRecoveryBoundary extends Component<
  ApplicationRecoveryBoundaryProps,
  ApplicationRecoveryBoundaryState
> {
  state: ApplicationRecoveryBoundaryState = {
    failed: false,
    pending: false,
    restartFailed: false,
    probeFailure: false,
  };
  static getDerivedStateFromError(): Partial<ApplicationRecoveryBoundaryState> {
    return { failed: true };
  }
  private disposeProbe?: () => void;
  componentDidMount() {
    this.disposeProbe = installRecoveryProbeListener((stage) => {
      if (stage !== 'root' || this.state.failed) return;
      void requestApplicationRestart(() => undefined)
        .then(() => {
          if (consumeRecoveryProbe('root'))
            this.setState({ probeFailure: true });
        })
        .catch(() =>
          reportRecoveryFailure(
            this.props.onFailure,
            'application',
            'recovery',
            'recovery_flush_failed',
          ),
        );
    });
  }
  componentWillUnmount() {
    this.disposeProbe?.();
  }
  componentDidCatch() {
    reportRecoveryFailure(
      this.props.onFailure ?? emitRecoveryFailure,
      'application',
      'render',
      'application_render_failed',
    );
  }
  private readonly restart = () => {
    if (this.state.pending) return;
    this.setState({ pending: true, restartFailed: false });
    void (this.props.restart ?? requestApplicationRestart)().catch(() => {
      this.setState({ pending: false, restartFailed: true });
      reportRecoveryFailure(
        this.props.onFailure,
        'application',
        'recovery',
        'recovery_flush_failed',
      );
    });
  };
  render() {
    if (!this.state.failed)
      return (
        <>
          {import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES === '1' &&
            this.state.probeFailure && <RootRecoveryProbeFailure />}
          {this.props.children}
        </>
      );
    return (
      <main className="application-recovery" role="alert">
        <h1>Glitchpad could not continue</h1>
        <p>
          Your original files were not changed by this display failure.
          Previously saved recovery records remain available. Edits since the
          last recovery snapshot may be unavailable.
        </p>
        <p>Recovery code: application_render_failed</p>
        <button
          type="button"
          disabled={this.state.pending}
          onClick={this.restart}
        >
          {this.state.pending
            ? 'Saving recovery before restart…'
            : 'Restart Glitchpad'}
        </button>
        {this.state.restartFailed && (
          <>
            <p role="status">
              Latest recovery could not be saved. Keep this screen open or
              restart with that limitation.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Restart without latest recovery
            </button>
          </>
        )}
      </main>
    );
  }
}

function RootRecoveryProbeFailure(): never {
  throw new Error('injected_root_failure');
}
