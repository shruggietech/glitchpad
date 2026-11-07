import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { EditorView } from '@codemirror/view';
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

it('names the active document from mounted controls across compact and wide multi-document layouts', () => {
  const previous = { width: window.innerWidth, height: window.innerHeight };
  const resize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: height,
    });
    fireEvent(window, new Event('resize'));
  };
  resize(320, 640);
  try {
    render(
      <App
        sessions={initialSessions.slice(0, 2)}
        persistenceGateway={null}
        recoveryGateway={null}
      />,
    );
    const first = screen.getByRole('region', {
      name: initialSessions[0].source.display_name,
    });
    expect(first).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    resize(1200, 800);
    const wide = screen.getByRole('tabpanel', {
      name: initialSessions[0].source.display_name,
    });
    const label = document.getElementById(
      wide.getAttribute('aria-labelledby') ?? '',
    );
    expect(label).toHaveAttribute('role', 'tab');
    expect(label).toHaveAttribute('aria-controls', wide.id);

    resize(320, 640);
    expect(
      screen.getByRole('region', {
        name: initialSessions[0].source.display_name,
      }),
    ).toBe(wide);
    expect(wide).not.toHaveAttribute('aria-labelledby');
  } finally {
    resize(previous.width, previous.height);
  }
});

it('keeps Read and Edit completion contextual without reserving document space', async () => {
  const session = createDraftSession('markdown', initialSessions[0]);
  render(
    <App
      sessions={[session]}
      persistenceGateway={null}
      recoveryGateway={null}
    />,
  );
  const editor = screen.getByRole('textbox');
  const view = EditorView.findFromDOM(editor)!;
  const source = view.state.doc.toString();
  const invoke = (label: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Document tools' }));
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Document tools' })).getByRole(
        'menuitem',
        { name: label },
      ),
    );
  };
  invoke('Read');
  expect(await screen.findByText('Completed Read.')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  expect(document.querySelector('.app-shell')).toHaveAttribute(
    'data-command-result-visible',
    'false',
  );
  invoke('Edit');
  expect(await screen.findByText('Completed Edit.')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Document tools' }),
    ).toHaveFocus(),
  );
  expect(document.querySelector('.app-shell')).toHaveAttribute(
    'data-command-result-visible',
    'false',
  );
  expect(EditorView.findFromDOM(editor)).toBe(view);
  expect(view.state.doc.toString()).toBe(source);
});

it('keeps the completed Add handoff when an earlier application-panel frame runs late', async () => {
  render(
    <App
      sessions={[initialSessions[0]]}
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
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  fireEvent.click(
    within(
      await screen.findByRole('menu', { name: 'Glitchpad menu' }),
    ).getByRole('menuitem', { name: 'Preferences' }),
  );
  const panel = await screen.findByRole('dialog', { name: 'Preferences' });
  const close = within(panel).getByRole('button', {
    name: 'Close Preferences',
  });
  await waitFor(() => expect(close).toBeEnabled());
  const late: FrameRequestCallback[] = [];
  const frames = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => {
      late.push(callback);
      return 100000 + late.length;
    });
  try {
    fireEvent.click(close);
  } finally {
    frames.mockRestore();
  }
  const add = screen.getByRole('button', { name: 'Add document' });
  fireEvent.click(add);
  fireEvent.click(
    within(
      await screen.findByRole('menu', { name: 'Add document choices' }),
    ).getByRole('menuitem', { name: 'New text file' }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('active-document-identity')).toHaveTextContent(
      'Untitled.txt',
    ),
  );
  await waitFor(() => expect(add).toHaveFocus());
  act(() => {
    late.forEach((callback) => callback(performance.now()));
  });
  expect(add).toHaveFocus();
});
