import { appendRecoveryHelp } from './recovery-help';
export type RecoveryFailureComponent =
  'bootstrap' | 'application' | 'document' | 'markdown';
export type RecoveryFailureReporter = (
  component: RecoveryFailureComponent,
  stage: string,
  reason: string,
) => void;
export interface BeforeRestartDetail {
  waitUntil(promise: Promise<unknown>): void;
}

export const emitRecoveryFailure: RecoveryFailureReporter = (
  component,
  stage,
  reason,
) => {
  window.dispatchEvent(
    new CustomEvent('glitchpad:failure', {
      detail: { component, stage, reason },
    }),
  );
};

export const reportRecoveryFailure = (
  reporter: RecoveryFailureReporter | undefined,
  component: RecoveryFailureComponent,
  stage: string,
  reason: string,
): void => {
  try {
    (reporter ?? emitRecoveryFailure)(component, stage, reason);
  } catch {
    /* A diagnostic sink cannot break the recovery surface. */
  }
};

export const requestApplicationRestart = async (
  reload: () => void = () => window.location.reload(),
): Promise<void> => {
  const pending: Promise<unknown>[] = [];
  window.dispatchEvent(
    new CustomEvent<BeforeRestartDetail>('glitchpad:before-restart', {
      detail: {
        waitUntil: (promise) => {
          pending.push(Promise.resolve(promise));
        },
      },
    }),
  );
  await Promise.all(pending);
  reload();
};

interface BootstrapOptions {
  onFailure?: RecoveryFailureReporter;
  restart?: () => Promise<void>;
}
interface ApplicationModule {
  mount(root: HTMLElement): void;
}

const showBootstrapFailure = (
  root: HTMLElement,
  options: BootstrapOptions,
  reason: string,
) => {
  const surface = document.createElement('main');
  surface.className = 'application-recovery';
  surface.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = 'Glitchpad could not start';
  const explanation = document.createElement('p');
  explanation.textContent =
    'Your original files were not changed by this startup failure. Previously saved recovery records remain available. Edits since the last recovery snapshot may be unavailable.';
  const code = document.createElement('p');
  code.textContent = 'Recovery code: ' + reason;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.textContent = 'Restart Glitchpad';
  restart.addEventListener('click', () => {
    restart.disabled = true;
    status.textContent = 'Saving recovery before restart…';
    void (options.restart ?? requestApplicationRestart)().catch(() => {
      restart.disabled = false;
      status.textContent =
        'Latest recovery could not be saved. Close and reopen only if you accept that edits since the last snapshot may be unavailable.';
    });
  });
  surface.append(title, explanation, code, restart, status);
  appendRecoveryHelp(surface);
  // Bootstrap recovery must work before application code or DOM shims load.
  while (root.firstChild) root.removeChild(root.firstChild);
  root.appendChild(surface);
  restart.focus();
};

export const bootstrapApplication = async (
  root: HTMLElement | null,
  loadApplication: () => Promise<ApplicationModule>,
  options: BootstrapOptions = {},
): Promise<void> => {
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    reportRecoveryFailure(
      options.onFailure,
      'bootstrap',
      'bootstrap',
      'root_missing',
    );
    showBootstrapFailure(root, options, 'root_missing');
    return;
  }
  let application: ApplicationModule;
  try {
    application = await loadApplication();
  } catch {
    reportRecoveryFailure(
      options.onFailure,
      'bootstrap',
      'bootstrap',
      'module_load_failed',
    );
    showBootstrapFailure(root, options, 'module_load_failed');
    return;
  }
  try {
    application.mount(root);
  } catch {
    reportRecoveryFailure(
      options.onFailure,
      'bootstrap',
      'bootstrap',
      'application_mount_failed',
    );
    showBootstrapFailure(root, options, 'application_mount_failed');
  }
};
