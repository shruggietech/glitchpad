import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { App } from './App';
import { createDraftSession } from './domain/drafts';
import { initialSessions } from './test/fixtures';
it('keeps a single document title visible and separates application destinations from document tools', async () => {
  render(
    <App
      sessions={[initialSessions[0]]}
      persistenceGateway={null}
      recoveryGateway={null}
      applicationInfoGateway={{
        info: vi.fn().mockResolvedValue({
          package_identifier: 'installed.example',
          version: '9.0',
          version_code: 90,
          channel: 'debug',
          platform: 'android',
          build_commit: 'native-source',
        }),
        notices: () => Promise.resolve('offline notices'),
      }}
    />,
  );
  expect(screen.getByTestId('active-document-identity')).toHaveTextContent(
    initialSessions[0].source.display_name,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const menu = await screen.findByRole('menu', { name: 'Glitchpad menu' });
  expect(
    within(menu).queryByRole('menuitem', { name: 'Copy' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(menu).getByRole('menuitem', { name: 'About Glitchpad' }),
  );
  expect(await screen.findByText('installed.example')).toBeInTheDocument();
  expect(screen.getByText('native-source')).toBeInTheDocument();
});

it('uses a compact document-count switcher and preserves the chosen document identity', async () => {
  const before = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 320,
  });
  try {
    render(
      <App
        sessions={initialSessions.slice(0, 2)}
        persistenceGateway={null}
        recoveryGateway={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '2 documents' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Open documents',
    });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: initialSessions[1].source.display_name,
      }),
    );
    expect(screen.getByTestId('active-document-identity')).toHaveTextContent(
      initialSessions[1].source.display_name,
    );
    expect(
      screen.queryByRole('dialog', { name: 'Open documents' }),
    ).not.toBeInTheDocument();
  } finally {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: before,
    });
  }
});

it('keeps short-window Add and document tools in one chrome row without duplicating draft identity', async () => {
  const previous = { width: window.innerWidth, height: window.innerHeight };
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 480,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 240,
  });
  try {
    render(
      <App
        sessions={[createDraftSession('text')]}
        persistenceGateway={null}
        recoveryGateway={null}
        androidDeliveryGateway={{
          choose: vi.fn().mockResolvedValue(null),
          close: vi.fn().mockResolvedValue(undefined),
          drain: vi.fn().mockResolvedValue({ sources: [], rejections: [] }),
          materialize: vi.fn(),
          subscribe: vi.fn().mockResolvedValue(() => undefined),
        }}
      />,
    );
    const add = await screen.findByRole('button', { name: 'Add document' });
    expect.soft(add.closest('.shell-chrome')).not.toBeNull();
    expect
      .soft(
        screen
          .getByRole('button', { name: 'Document tools' })
          .closest('.shell-chrome'),
      )
      .not.toBeNull();
    expect
      .soft(document.querySelector('.app-shell'))
      .toHaveAttribute('data-has-draft-identity', 'false');
    expect
      .soft(document.querySelectorAll('[data-draft-identity]'))
      .toHaveLength(1);
    expect
      .soft(
        document
          .querySelector('[data-draft-identity]')
          ?.closest('.shell-chrome'),
      )
      .not.toBeNull();
    expect(document.querySelector('[data-draft-identity]')).toHaveTextContent(
      'Untitled.txt',
    );
    expect(document.querySelector('[data-draft-identity]')).toHaveTextContent(
      'Unsaved changes',
    );
    fireEvent.click(add);
    expect(
      await screen.findByRole('menu', { name: 'Add document choices' }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('#bb-overlay-root .add-document-menu'),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Close Add document' }),
    );
    expect(add).toHaveFocus();
  } finally {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: previous.width,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: previous.height,
    });
  }
});
