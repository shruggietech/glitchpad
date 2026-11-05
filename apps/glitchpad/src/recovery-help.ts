import {
  applicationDestinations,
  nativeApplicationInfoGateway,
  type ApplicationInfoGateway,
} from './domain/application-info';
import {
  nativeMarkdownExternalLinkGateway,
  type MarkdownExternalLinkGateway,
} from './domain/markdown-gateway';
/** Minimal DOM support surface that does not import the application/renderer tree. */
export function appendRecoveryHelp(
  parent: HTMLElement,
  gateway: ApplicationInfoGateway = nativeApplicationInfoGateway,
  external: MarkdownExternalLinkGateway = nativeMarkdownExternalLinkGateway,
): () => void {
  let active = true,
    loaded = false;
  const section = document.createElement('section');
  section.className = 'recovery-help';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = 'Help and About';
  trigger.setAttribute('aria-expanded', 'false');
  const body = document.createElement('div');
  body.hidden = true;
  body.setAttribute('aria-label', 'Help and About');
  const intro = document.createElement('p');
  intro.textContent =
    'Glitchpad by ShruggieTech. Core files stay local. Support opens only when selected and never attaches documents or diagnostics automatically.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const identity = document.createElement('dl');
  const notices = document.createElement('pre');
  notices.hidden = true;
  notices.tabIndex = 0;
  notices.setAttribute('aria-label', 'Offline license notices');
  const license = document.createElement('button');
  license.type = 'button';
  license.textContent = 'Offline licenses and notices';
  license.setAttribute('aria-expanded', 'false');
  license.addEventListener('click', () => {
    if (!notices.hidden) {
      notices.hidden = true;
      license.setAttribute('aria-expanded', 'false');
      return;
    }
    license.disabled = true;
    void gateway
      .notices()
      .then((text) => {
        if (active) {
          notices.textContent = text;
          notices.hidden = false;
          license.setAttribute('aria-expanded', 'true');
          status.textContent = '';
        }
      })
      .catch(() => {
        if (active)
          status.textContent = 'Offline license notices could not be loaded.';
      })
      .finally(() => {
        if (active) license.disabled = false;
      });
  });
  body.append(intro, identity);
  for (const destination of applicationDestinations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = destination.label;
    button.addEventListener('click', () => {
      button.disabled = true;
      void external
        .open(destination.target)
        .then(() => {
          if (active) status.textContent = '';
        })
        .catch(() => {
          if (active)
            status.textContent = 'The destination could not be opened.';
        })
        .finally(() => {
          if (active) button.disabled = false;
        });
    });
    body.append(button);
  }
  body.append(license, notices, status);
  section.append(trigger, body);
  parent.append(section);
  trigger.addEventListener('click', () => {
    body.hidden = !body.hidden;
    trigger.setAttribute('aria-expanded', String(!body.hidden));
    if (loaded || body.hidden) return;
    loaded = true;
    void gateway
      .info()
      .then((info) => {
        if (!active) return;
        for (const [label, value] of [
          ['Version', info.version],
          ['Package', info.package_identifier],
          ['Version code', info.version_code ?? 'Unavailable'],
          ['Build', info.build_commit ?? 'Unavailable'],
          ['Channel', info.channel],
          ['Platform', info.platform],
        ]) {
          const term = document.createElement('dt');
          term.textContent = String(label);
          const detail = document.createElement('dd');
          detail.textContent = String(value);
          identity.append(term, detail);
        }
      })
      .catch(() => {
        if (active)
          status.textContent =
            'Installed application information is unavailable.';
      });
  });
  return () => {
    active = false;
    section.remove();
  };
}
