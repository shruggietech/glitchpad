import axe from 'axe-core';
import { EditorView } from '@codemirror/view';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { App } from './App';
import { collectFailureEvents } from './domain/diagnostic-failures';
import { createDraftSession } from './domain/drafts';
import type {
  AndroidDestinationReceipt,
  ShellSession,
} from './domain/contracts';
import { initialSessions, makeSession } from './test/fixtures';
import { RecoveryCandidateResolution } from './components/RecoveryResolution';
import type { RecoveryGateway } from './domain/recovery-gateway';
import type { MetadataGateway } from './domain/metadata-gateway';
import type {
  IntegrityProgress,
  IntegrityStartRequest,
} from './domain/contracts';
import { DESKTOP_CHROME_MAX_PX, REFERENCE_HEIGHT_PX } from './domain/tabs';
import { defaultPreferences } from './domain/persistence';
import type { PersistenceGateway } from './domain/persistence-gateway';
import type { AndroidRestorationGateway } from './domain/android-restoration-gateway';
import type { AndroidDeliveryGateway } from './domain/android-delivery-gateway';
import type { DesktopDeliveryGateway } from './domain/desktop-delivery-gateway';

function getApplicationShell() {
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) throw new Error('application shell was not rendered');
  return shell;
}

const revision = {
  identity: initialSessions[2].source.identity,
  byte_length: 3,
  modified_unix_nanos: '1',
  change_token: null,
};
const saveReceipt = {
  operation_id: '1',
  source_id: 'source',
  accepted_session_revision: 2,
  previous_external_revision: revision,
  new_external_revision: revision,
  byte_count: 1,
  durability: 'atomic_file_and_directory' as const,
};

const invokeMenu = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const matcher = typeof name === 'string' ? name : name;
  fireEvent.click(
    within(screen.getByRole('menu', { name: 'Glitchpad menu' })).getByRole(
      'menuitem',
      { name: matcher },
    ),
  );
};

const authoringDelivery = (
  overrides: Partial<AndroidDeliveryGateway> = {},
): AndroidDeliveryGateway => ({
  choose: vi.fn().mockResolvedValue(null),
  close: vi.fn().mockResolvedValue(undefined),
  drain: vi.fn().mockResolvedValue({ sources: [], rejections: [] }),
  materialize: vi.fn(),
  subscribe: vi.fn().mockResolvedValue(() => undefined),
  ...overrides,
});
const destinationFor = (session: ShellSession): AndroidDestinationReceipt => ({
  saved_revision: session.revision,
  byte_count: session.text_document?.source_bytes ?? 0,
  source: {
    source_id: 'saved-source',
    descriptor: {
      ...session.source,
      kind: 'document_uri',
      display_name: 'Saved.txt',
    },
    external_revision: {
      identity: session.source.identity,
      byte_length: session.text_document?.source_bytes ?? 0,
      modified_unix_nanos: null,
      change_token: null,
    },
    delivery_kind: 'create_result',
    grant: {
      read: true,
      write: true,
      persisted_read: true,
      persisted_write: true,
      restorable: true,
    },
  },
});

describe('document foundation shell', () => {
  const persistenceGateway = (
    overrides: Partial<PersistenceGateway> = {},
  ): PersistenceGateway => ({
    loadPreferences: vi.fn().mockResolvedValue({
      status: 'loaded',
      value: defaultPreferences(),
      warning_code: null,
    }),
    persistPreferences: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue({
      status: 'defaulted',
      value: {
        schema_version: 1,
        window: { active_session_index: null, inspector: 'closed' },
        sessions: [],
      },
      warning_code: null,
    }),
    persistSession: vi.fn().mockResolvedValue(undefined),
    appendDiagnostic: vi.fn().mockResolvedValue(undefined),
    previewDiagnostics: vi.fn().mockResolvedValue({
      status: 'loaded',
      value: {
        schema_version: 1,
        generated_unix_ms: 42,
        environment: {
          product_version: '0.0.0',
          specification_version: '0.0.0',
          platform: 'unknown',
          architecture: 'unknown',
          webview_version: null,
          core_version: '0.0.0',
          build_commit: null,
        },
        events: [],
      },
      warning_code: null,
    }),
    reset: vi.fn().mockResolvedValue(false),
    ...overrides,
  });

  it('creates separate Android Markdown and text drafts and preserves edits while switching', async () => {
    render(
      <App
        androidDeliveryGateway={authoringDelivery()}
        recoveryGateway={null}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add document' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Markdown' }));
    expect(document.querySelector('[data-draft-identity]')).toHaveTextContent(
      'Untitled.md',
    );
    expect(document.querySelector('[data-draft-identity]')).toHaveTextContent(
      'Unsaved changes',
    );
    const markdown = screen.getByRole('textbox', {
      name: 'Untitled.md text editor',
    });
    act(() => {
      const view = EditorView.findFromDOM(markdown)!;
      view.dispatch({ changes: { from: 0, insert: '# Local draft' } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New text file' }));
    expect(
      screen.getByRole('textbox', { name: 'Untitled.txt text editor' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Untitled.md/u }));
    expect(
      screen.getByRole('textbox', { name: 'Untitled.md text editor' }),
    ).toHaveTextContent('# Local draft');
  });

  it('keeps Android draft edits after cancelled Save and blocks Close while the native write is pending', async () => {
    const draft = createDraftSession('text');
    let finish:
      ((receipt: AndroidDestinationReceipt | null) => void) | undefined;
    const saveAs = vi.fn(
      () =>
        new Promise<AndroidDestinationReceipt | null>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery()}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => {
      finish?.(null);
      await Promise.resolve();
    });
    expect(
      screen.getByRole('region', { name: 'Untitled.txt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cancelled. Your document and edits remain available.'),
    ).toBeInTheDocument();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsaved changes');
  });

  it('does not launch native Save after recovery replaces the application while flushing', async () => {
    const draft = createDraftSession('text');
    let finishSnapshot: (() => void) | undefined;
    const remove = vi.fn().mockResolvedValue(true);
    const gateway: RecoveryGateway = {
      inventory: vi.fn().mockResolvedValue([]),
      load: vi.fn(),
      remove,
      persist: vi.fn<RecoveryGateway['persist']>(
        (record) =>
          new Promise((resolve) => {
            finishSnapshot = () =>
              resolve({
                record_id: record.record_id,
                display_hint: record.display_hint,
                status: 'available',
                updated_unix_ms: record.updated_unix_ms,
                expires_unix_ms: record.updated_unix_ms + 1,
                committed_bytes: 0,
              });
          }),
      ),
    };
    const saveAs = vi.fn().mockResolvedValue(null);
    const app = render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery()}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={gateway}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    await waitFor(() => expect(finishSnapshot).toBeDefined());
    app.unmount();
    await act(async () => {
      finishSnapshot?.();
      await Promise.resolve();
    });
    expect(saveAs).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('releases a native destination returned after application recovery unmounts the shell', async () => {
    const draft = createDraftSession('text');
    let finish: ((receipt: AndroidDestinationReceipt) => void) | undefined;
    const saveAs = vi.fn(
      () =>
        new Promise<AndroidDestinationReceipt>((resolve) => {
          finish = resolve;
        }),
    );
    const close = vi.fn().mockResolvedValue(undefined);
    const app = render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery({ close })}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    app.unmount();
    await act(async () => {
      finish?.(destinationFor(draft));
      await Promise.resolve();
    });
    expect(close).toHaveBeenCalledExactlyOnceWith('saved-source');
  });

  it('preserves native copy and undo shortcuts in the rendered Markdown search field', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    render(
      <App
        sessions={[initialSessions[3]]}
        clipboardGateway={{ write }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 'f', ctrlKey: true });
    const search = await screen.findByRole('textbox', {
      name: 'Find rendered text',
    });
    fireEvent.change(search, { target: { value: 'Draft' } });
    search.focus();
    for (const key of ['c', 'z']) {
      expect(fireEvent.keyDown(search, { key, ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(search, { key, metaKey: true })).toBe(true);
    }
    await act(async () => {
      await Promise.resolve();
    });
    expect(write).not.toHaveBeenCalled();
    expect(search).toHaveValue('Draft');
  });

  it('keeps Preferences field shortcuts from copying or undoing the active document', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    render(
      <App
        sessions={[createDraftSession('text')]}
        clipboardGateway={{ write }}
        recoveryGateway={null}
      />,
    );
    const editor = screen.getByRole('textbox', {
      name: 'Untitled.txt text editor',
    });
    act(() => {
      EditorView.findFromDOM(editor)!.dispatch({
        changes: { from: 0, insert: 'Keep document edit' },
      });
    });
    invokeMenu('Preferences');
    const font = await screen.findByRole('textbox', {
      name: 'Editor font family',
    });
    font.focus();
    for (const key of ['c', 'z']) {
      expect(fireEvent.keyDown(font, { key, ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(font, { key, metaKey: true })).toBe(true);
    }
    await act(async () => {
      await Promise.resolve();
    });
    expect(write).not.toHaveBeenCalled();
    expect(editor).toHaveTextContent('Keep document edit');
    fireEvent.click(screen.getByRole('button', { name: 'Close preferences' }));
    editor.focus();
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(editor).not.toHaveTextContent('Keep document edit');
  });

  it('binds a successful native destination without cleaning edits made after the requested revision', async () => {
    const draft = createDraftSession('text');
    let finish: ((receipt: AndroidDestinationReceipt) => void) | undefined;
    const saveAs = vi.fn(
      () =>
        new Promise<AndroidDestinationReceipt>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery()}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    const textbox = screen.getByRole('textbox', {
      name: 'Untitled.txt text editor',
    });
    act(() => {
      const view = EditorView.findFromDOM(textbox)!;
      view.dispatch({ changes: { from: 0, insert: 'Newer edits' } });
    });
    await act(async () => {
      finish?.(destinationFor(draft));
      await Promise.resolve();
    });
    expect(
      screen.getByRole('textbox', { name: 'Saved.txt text editor' }),
    ).toHaveTextContent('Newer edits');
    expect(
      screen.getByText('Saved earlier revision. Newer edits remain unsaved.'),
    ).toBeInTheDocument();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsaved changes');
  });

  it('dismisses the Android application menu before Back can close the current document', async () => {
    let back: ((id: string) => void) | undefined;
    const completeBack = vi.fn().mockResolvedValue(undefined);
    const delivery = authoringDelivery({
      subscribeBack: (handler) => {
        back = handler;
        return Promise.resolve(() => undefined);
      },
      completeBack,
    });
    render(
      <App sessions={[initialSessions[2]]} androidDeliveryGateway={delivery} />,
    );
    await waitFor(() => expect(back).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    act(() => back?.('first'));
    await waitFor(() =>
      expect(
        screen.queryByRole('menu', { name: 'Glitchpad menu' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('region', { name: 'notes.txt' }),
    ).toBeInTheDocument();
    expect(completeBack).toHaveBeenCalledWith('first', true);
  });

  it('releases the new Android source after dirty-close Save As completes', async () => {
    const draft = createDraftSession('text');
    let finish: ((receipt: AndroidDestinationReceipt) => void) | undefined;
    const saveAs = vi.fn(
      () =>
        new Promise<AndroidDestinationReceipt>((resolve) => {
          finish = resolve;
        }),
    );
    const close = vi.fn().mockResolvedValue(undefined);
    render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery({ close })}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Save As',
      }),
    );
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
    await act(async () => {
      finish?.(destinationFor(draft));
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => expect(close).toHaveBeenCalledWith('saved-source'));
  });

  it('keeps draft and gives an actionable destination-conflict outcome without exposing native details', async () => {
    const draft = createDraftSession('text');
    const saveAs = vi.fn().mockRejectedValue({
      context: { reason: 'destination_conflict' },
      message: 'content://private/file',
    });
    render(
      <App
        sessions={[draft]}
        androidDeliveryGateway={authoringDelivery()}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    expect(
      await screen.findByText(/That destination already contains a document/u),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('content://private/file');
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsaved changes');
  });

  it('does not publish an earlier document save result onto a newly active document', async () => {
    const draft = createDraftSession('text');
    const second = {
      ...createDraftSession('text'),
      source: {
        ...createDraftSession('text').source,
        display_name: 'Second.txt',
      },
    };
    let finish: ((receipt: AndroidDestinationReceipt) => void) | undefined;
    const saveAs = vi.fn(
      () =>
        new Promise<AndroidDestinationReceipt>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <App
        sessions={[draft, second]}
        androidDeliveryGateway={authoringDelivery()}
        androidAuthoringGateway={{ saveAs }}
        recoveryGateway={null}
      />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('tab', { name: /Second.txt/u }));
    await act(async () => {
      finish?.(destinationFor(draft));
      await Promise.resolve();
    });
    expect(
      screen.getByRole('textbox', { name: 'Second.txt text editor' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Saved after native verification.'),
    ).not.toBeInTheDocument();
  });

  it('dismisses the active Markdown external-link modal before native Back can close its clean document', async () => {
    let back: ((id: string) => void) | undefined;
    const completeBack = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);
    const session = makeSession(
      'external-link',
      'external.md',
      'Markdown',
      '[destination](https://example.com/path)',
      { search: true },
    );
    render(
      <App
        sessions={[session]}
        androidDeliveryGateway={authoringDelivery({
          subscribeBack: (handler) => {
            back = handler;
            return Promise.resolve(() => undefined);
          },
          completeBack,
        })}
        externalLinkGateway={{ open }}
        recoveryGateway={null}
      />,
    );
    await waitFor(() => expect(back).toBeDefined());
    const trigger = await screen.findByRole('button', { name: /destination/u });
    fireEvent.click(trigger);
    expect(
      await screen.findByRole('dialog', { name: 'Open external destination?' }),
    ).toBeInTheDocument();
    act(() => back?.('modal-back'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('region', { name: 'external.md' }),
    ).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    expect(completeBack).toHaveBeenCalledWith('modal-back', true);
    await waitFor(() => expect(trigger).toHaveFocus());
    act(() => back?.('document-back'));
    expect(
      screen.queryByRole('region', { name: 'external.md' }),
    ).not.toBeInTheDocument();
    expect(completeBack).toHaveBeenCalledWith('document-back', true);
    act(() => back?.('empty-back'));
    expect(completeBack).toHaveBeenCalledWith('empty-back', false);
  });

  it('consumes measured IME Back before requesting dirty document close', async () => {
    let back: ((id: string) => void) | undefined;
    const delivery = authoringDelivery({
      subscribeBack: (handler) => {
        back = handler;
        return Promise.resolve(() => undefined);
      },
      completeBack: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <App
        sessions={[createDraftSession('text')]}
        androidDeliveryGateway={delivery}
        recoveryGateway={null}
      />,
    );
    await waitFor(() => expect(back).toBeDefined());
    const textbox = screen.getByRole('textbox', {
      name: 'Untitled.txt text editor',
    });
    textbox.focus();
    const frame = document.querySelector<HTMLElement>('[data-bb-app-frame]')!;
    frame.style.setProperty('--bb-ime-block-end', '200px');
    act(() => back?.('ime'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    frame.style.setProperty('--bb-ime-block-end', '0px');
    act(() => back?.('document'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsaved changes');
  });

  it('keeps a busy diagnostic panel open when native Back arrives', async () => {
    let back: ((id: string) => void) | undefined;
    let finish: (() => void) | undefined;
    const delivery = authoringDelivery({
      subscribeBack: (handler) => {
        back = handler;
        return Promise.resolve(() => undefined);
      },
      completeBack: vi.fn().mockResolvedValue(undefined),
    });
    const exporter = {
      export: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    render(
      <App
        androidDeliveryGateway={delivery}
        diagnosticExportGateway={exporter}
        persistenceGateway={persistenceGateway()}
      />,
    );
    invokeMenu('Diagnostics');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Export previewed bundle' }),
    );
    await waitFor(() => expect(exporter.export).toHaveBeenCalledOnce());
    act(() => back?.('pending'));
    expect(
      screen.getByRole('heading', { name: 'Diagnostics' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close diagnostics' }),
    ).toBeDisabled();
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    act(() => back?.('complete'));
    expect(
      screen.queryByRole('heading', { name: 'Diagnostics' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['worker', 'Markdown preview worker failed.'],
    ['parser', 'Markdown preview failed safely.'],
    ['projection', 'Markdown projection failed.'],
  ] as const)(
    'contains the compiled %s fault at the active Markdown boundary and recovers',
    async (stage, message) => {
      vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
      try {
        render(<App sessions={[initialSessions[3]]} />);
        await screen.findByText('Unsaved fixture content.');
        act(() => {
          window.dispatchEvent(
            new CustomEvent('glitchpad:test-recovery', { detail: { stage } }),
          );
        });
        expect(await screen.findByRole('alert')).toHaveTextContent(message);
        expect(screen.getByRole('button', { name: 'Menu' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: 'View source' }));
        expect(
          screen.getByRole('textbox', { name: 'draft.md text editor' }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
        expect(
          await screen.findByText('Unsaved fixture content.'),
        ).toBeInTheDocument();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it('starts with no synthetic documents in the production shell', () => {
    render(<App />);
    expect(
      within(
        screen.getByRole('region', { name: 'Document surface' }),
      ).getByText('No document is open'),
    ).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Menu' }).closest('.shell-chrome'),
    ).toBeInTheDocument();
    for (const fixture of ['welcome.md', 'draft.md', 'notes.txt'])
      expect(screen.queryByText(fixture)).not.toBeInTheDocument();
  });

  it('adopts one generated full-bleed Tauri AppFrame as the semantic shell', () => {
    render(<App />);
    const frame = document.querySelector<HTMLElement>('[data-bb-app-frame]');
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute('data-bb-host', 'tauri');
    expect(frame).toHaveAttribute('data-bb-layout', 'full-bleed');
    expect(document.querySelectorAll('[data-bb-app-frame]')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toContainElement(getApplicationShell());
    expect(
      document.documentElement.style.getPropertyValue(
        '--bb-visual-viewport-height',
      ),
    ).not.toBe('');
  });

  it('does not classify a focused desktop window resize as an IME inset', () => {
    const originalInnerHeight = Object.getOwnPropertyDescriptor(
      window,
      'innerHeight',
    );
    const probe = document.createElement('textarea');
    try {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 800,
      });
      render(<App />);
      document.body.append(probe);
      probe.focus();
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 600,
      });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(
        document.documentElement.style.getPropertyValue('--bb-ime-block-end'),
      ).toBe('0px');
    } finally {
      probe.remove();
      if (originalInnerHeight) {
        Object.defineProperty(window, 'innerHeight', originalInnerHeight);
      }
    }
  });

  it('retains the focused layout baseline when the host declares resize can be IME', () => {
    const originalInnerHeight = Object.getOwnPropertyDescriptor(
      window,
      'innerHeight',
    );
    const probe = document.createElement('textarea');
    try {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 800,
      });
      render(<App layoutResizeCanBeIme />);
      document.body.append(probe);
      probe.focus();
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 600,
      });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(
        document.documentElement.style.getPropertyValue('--bb-ime-block-end'),
      ).toBe('200px');
    } finally {
      probe.remove();
      if (originalInnerHeight) {
        Object.defineProperty(window, 'innerHeight', originalInnerHeight);
      }
    }
  });

  it('shows native delivery failures as an actionable visible alert', async () => {
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([
        {
          sequence: 1,
          kind: 'association',
          status: 'rejected',
          source: null,
          error: {
            summary: 'The selected file cannot be read.',
            retryable: true,
          },
        },
      ]),
      materialize: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(false),
      saveAs: vi.fn().mockResolvedValue(false),
      subscribe: vi.fn().mockResolvedValue(() => undefined),
    };
    render(<App sessions={[]} desktopDeliveryGateway={gateway} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The selected file cannot be read.',
    );
  });

  for (const platform of ['desktop', 'android'] as const) {
    const boundaries =
      platform === 'android'
        ? ([
            'rejection',
            'drain',
            'read',
            'picker',
            'subscription',
            'picker_read',
          ] as const)
        : (['rejection', 'drain', 'read', 'picker', 'subscription'] as const);
    for (const boundary of boundaries) {
      it(
        'captures one bounded ' +
          platform +
          ' source failure at the ' +
          boundary +
          ' boundary',
        async () => {
          const baseline = new Set(
            (await collectFailureEvents()).map(
              (event) => event.failure?.correlation_id,
            ),
          );
          const privateDetail =
            'Secret-document content://private/provider C:\\private\\document';
          const error = new Error(privateDetail);
          const source = destinationFor(createDraftSession('text')).source;
          source.source_id = privateDetail;
          source.descriptor.display_name = privateDetail;
          const close = vi.fn().mockResolvedValue(undefined);
          const choose = vi.fn();
          const drain = vi.fn();
          const materialize = vi.fn().mockRejectedValue(error);
          const subscribe = vi.fn().mockResolvedValue(() => undefined);
          if (platform === 'desktop') {
            const delivered = {
              sequence: 1,
              kind: 'association',
              status: 'opened',
              source,
              error: null,
            };
            choose.mockResolvedValue([]);
            drain.mockResolvedValue([]);
            if (boundary === 'rejection')
              drain.mockResolvedValueOnce([
                {
                  ...delivered,
                  status: 'rejected',
                  source: null,
                  error: {
                    summary: 'The selected file cannot be read.',
                    retryable: true,
                  },
                },
              ]);
            if (boundary === 'read') drain.mockResolvedValueOnce([delivered]);
            if (boundary === 'drain') drain.mockRejectedValueOnce(error);
            if (boundary === 'picker') choose.mockRejectedValue(error);
            if (boundary === 'subscription') subscribe.mockRejectedValue(error);
            const gateway: DesktopDeliveryGateway = {
              choose,
              drain,
              materialize,
              subscribe,
              close,
              save: vi.fn(),
              saveAs: vi.fn(),
            };
            render(
              <App
                sessions={[initialSessions[2]]}
                desktopDeliveryGateway={gateway}
                recoveryGateway={null}
              />,
            );
          } else {
            choose.mockResolvedValue(null);
            drain.mockResolvedValue({ sources: [], rejections: [] });
            if (boundary === 'rejection')
              drain.mockResolvedValueOnce({
                sources: [],
                rejections: [{ code: privateDetail, retryable: true }],
              });
            if (boundary === 'read')
              drain.mockResolvedValueOnce({
                sources: [source],
                rejections: [],
              });
            if (boundary === 'drain') drain.mockRejectedValueOnce(error);
            if (boundary === 'picker') choose.mockRejectedValue(error);
            if (boundary === 'picker_read') choose.mockResolvedValue(source);
            if (boundary === 'subscription') subscribe.mockRejectedValue(error);
            render(
              <App
                sessions={[initialSessions[2]]}
                androidDeliveryGateway={authoringDelivery({
                  choose,
                  drain,
                  materialize,
                  subscribe,
                  close,
                })}
                recoveryGateway={null}
              />,
            );
          }
          if (boundary === 'picker' || boundary === 'picker_read')
            invokeMenu('Open…');
          const captured = () =>
            collectFailureEvents().then((events) =>
              events.filter(
                (event) =>
                  event.failure?.component === 'source' &&
                  !baseline.has(event.failure.correlation_id),
              ),
            );
          await waitFor(async () => expect(await captured()).toHaveLength(1));
          const events = await captured();
          const isRead = boundary === 'read' || boundary === 'picker_read';
          expect(events[0]).toMatchObject({
            event_id: 'task_failed',
            error_code: isRead
              ? 'source_read_failed'
              : 'source_delivery_failed',
            failure: {
              component: 'source',
              stage: isRead ? 'read' : 'delivery',
              reason: isRead ? 'source_read_failed' : 'source_delivery_failed',
            },
          });
          expect(events[0].failure?.correlation_id).toMatch(/^[0-9a-f]{32}$/u);
          expect(JSON.stringify(events)).not.toMatch(
            /Secret-document|content:|private|provider|Error:/u,
          );
          expect(
            screen.getByRole('region', { name: 'notes.txt' }),
          ).toBeInTheDocument();
          if (boundary === 'subscription' && platform === 'android') {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            await waitFor(() => expect(drain).toHaveBeenCalled());
          } else
            expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
          if (isRead)
            expect(close).toHaveBeenCalledExactlyOnceWith(privateDetail);
        },
      );
    }

    it(
      'keeps a neutral ' +
        platform +
        ' Open cancellation out of failure diagnostics',
      async () => {
        const before = await collectFailureEvents();
        const choose = vi
          .fn()
          .mockResolvedValue(platform === 'android' ? null : []);
        if (platform === 'android')
          render(
            <App
              sessions={[initialSessions[2]]}
              androidDeliveryGateway={authoringDelivery({ choose })}
              recoveryGateway={null}
            />,
          );
        else {
          const gateway: DesktopDeliveryGateway = {
            choose,
            drain: vi.fn().mockResolvedValue([]),
            materialize: vi.fn(),
            close: vi.fn(),
            save: vi.fn(),
            saveAs: vi.fn(),
            subscribe: vi.fn().mockResolvedValue(() => undefined),
          };
          render(
            <App
              sessions={[initialSessions[2]]}
              desktopDeliveryGateway={gateway}
              recoveryGateway={null}
            />,
          );
        }
        invokeMenu('Open…');
        await waitFor(() => expect(choose).toHaveBeenCalledOnce());
        await act(async () => {
          await Promise.resolve();
        });
        expect(await collectFailureEvents()).toEqual(before);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(
          screen.getByRole('region', { name: 'notes.txt' }),
        ).toBeInTheDocument();
      },
    );
  }

  it('opens initial and warm Android deliveries and releases closed sources', async () => {
    const delivered = {
      ...initialSessions[2],
      id: 'android-source',
      source_id: 'source',
      external_revision: revision,
    };
    let notify: (() => void) | undefined;
    const drain = vi
      .fn()
      .mockResolvedValueOnce({
        sources: [
          {
            source_id: 'source',
            descriptor: delivered.source,
            external_revision: revision,
            delivery_kind: 'view',
            grant: {
              read: true,
              write: false,
              persisted_read: false,
              persisted_write: false,
              restorable: false,
            },
          },
        ],
        rejections: [],
      })
      .mockResolvedValue({ sources: [], rejections: [] });
    const close = vi.fn().mockResolvedValue(undefined);
    const gateway: AndroidDeliveryGateway = {
      close,
      drain,
      materialize: vi.fn().mockResolvedValue(delivered),
      subscribe: vi.fn().mockImplementation((handler: () => void) => {
        notify = handler;
        return Promise.resolve(() => undefined);
      }),
    };

    render(<App sessions={[]} androidDeliveryGateway={gateway} />);
    await screen.findByRole('region', { name: 'notes.txt' });
    notify?.();
    await waitFor(() => expect(drain).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    await waitFor(() => expect(close).toHaveBeenCalledWith('source'));
  });

  it('drains cold and warm Android deliveries when event subscription is unavailable', async () => {
    const delivered = {
      ...initialSessions[2],
      id: 'android-source',
      source_id: 'source',
      external_revision: revision,
    };
    const drain = vi
      .fn()
      .mockResolvedValueOnce({
        sources: [
          {
            source_id: 'source',
            descriptor: delivered.source,
            external_revision: revision,
            delivery_kind: 'view',
            grant: {
              read: true,
              write: false,
              persisted_read: false,
              persisted_write: false,
              restorable: false,
            },
          },
        ],
        rejections: [],
      })
      .mockResolvedValue({ sources: [], rejections: [] });
    const gateway: AndroidDeliveryGateway = {
      close: vi.fn().mockResolvedValue(undefined),
      drain,
      materialize: vi.fn().mockResolvedValue(delivered),
      subscribe: vi.fn().mockRejectedValue(new Error('listener unavailable')),
    };

    render(<App sessions={[]} androidDeliveryGateway={gateway} />);

    expect(
      await screen.findByRole('region', { name: 'notes.txt' }),
    ).toBeVisible();
    await waitFor(() => expect(drain).toHaveBeenCalledTimes(2), {
      timeout: 1_500,
    });
  });

  it('offers native desktop Save As for an editable copy and retains its edits after picker cancellation', async () => {
    const original: ShellSession = {
      ...initialSessions[2],
      id: 'desktop-readonly-source',
      source_id: 'readonly-source',
      external_revision: revision,
      source: {
        ...initialSessions[2].source,
        capabilities: {
          ...initialSessions[2].source.capabilities,
          write: false,
        },
      },
    };
    const saveAs = vi
      .fn<DesktopDeliveryGateway['saveAs']>()
      .mockResolvedValue(false);
    const save = vi.fn();
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([]),
      materialize: vi.fn(),
      subscribe: vi.fn().mockResolvedValue(() => undefined),
      close: vi.fn().mockResolvedValue(undefined),
      save,
      saveAs,
    };
    render(
      <App
        sessions={[original]}
        desktopDeliveryGateway={gateway}
        recoveryGateway={null}
      />,
    );
    invokeMenu('Edit a copy');
    const editor = await screen.findByRole('textbox', {
      name: 'Copy of notes.txt text editor',
    });
    act(() => {
      const view = EditorView.findFromDOM(editor)!;
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nLocal copy edit' },
      });
    });
    invokeMenu('Save As…');
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    expect(saveAs).toHaveBeenCalledWith(
      expect.objectContaining({
        source_id: null,
        edit_origin: 'copy',
        dirty: true,
        content: original.content + '\nLocal copy edit',
      }),
    );
    expect(saveAs.mock.calls[0][0].text_document?.raw_text).toBe(
      original.content + '\nLocal copy edit',
    );
    expect(save).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Cancelled. Your document and edits remain available.',
      ),
    ).toBeVisible();
    expect(editor).toHaveTextContent('Local copy edit');
    expect(screen.getByRole('tab', { name: 'notes.txt' })).toBeInTheDocument();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Unsaved changes');
  });

  it('retains the desktop source lease until the last editable copy closes', async () => {
    const original: ShellSession = {
      ...initialSessions[2],
      id: 'desktop-original',
      source_id: 'original',
      external_revision: revision,
      source: {
        ...initialSessions[2].source,
        capabilities: {
          ...initialSessions[2].source.capabilities,
          write: false,
        },
      },
    };
    const close = vi.fn().mockResolvedValue(undefined);
    const saveAs = vi
      .fn<DesktopDeliveryGateway['saveAs']>()
      .mockResolvedValue(false);
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([]),
      materialize: vi.fn(),
      subscribe: vi.fn().mockResolvedValue(() => undefined),
      close,
      saveAs,
      save: vi.fn(),
    };
    render(
      <App
        sessions={[original]}
        desktopDeliveryGateway={gateway}
        recoveryGateway={null}
      />,
    );
    invokeMenu('Edit a copy');
    await screen.findByRole('textbox', {
      name: 'Copy of notes.txt text editor',
    });
    fireEvent.click(screen.getByRole('tab', { name: 'notes.txt' }));
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(
      screen.getByRole('textbox', { name: 'Copy of notes.txt text editor' }),
    ).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    invokeMenu('Save As…');
    await waitFor(() => expect(saveAs).toHaveBeenCalledOnce());
    expect(saveAs.mock.calls[0][0].copy_source).toEqual({
      source_id: 'original',
      external_revision: revision,
    });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Discard',
      }),
    );
    await waitFor(() =>
      expect(close).toHaveBeenCalledExactlyOnceWith('original'),
    );
  });

  it('opens native desktop deliveries through the compact application commands', async () => {
    const subscriptionOrder: string[] = [];
    const delivered = {
      ...initialSessions[2],
      id: 'desktop-source',
      source_id: 'source',
      external_revision: revision,
    };
    const choose = vi.fn().mockResolvedValue([
      {
        sequence: 1,
        kind: 'dialog',
        status: 'opened',
        source: {
          source_id: 'source',
          descriptor: delivered.source,
          external_revision: revision,
        },
        error: null,
      },
    ]);
    const materialize = vi.fn().mockResolvedValue(delivered);
    const close = vi.fn().mockResolvedValue(undefined);
    const save = vi.fn((captured: ShellSession) =>
      Promise.resolve({
        ...saveReceipt,
        operation_id: captured.destination_save_operation_id!,
      }),
    );
    const gateway: DesktopDeliveryGateway = {
      choose,
      drain: vi.fn().mockImplementation(() => {
        subscriptionOrder.push('drain');
        return Promise.resolve([]);
      }),
      close,
      save,
      materialize,
      saveAs: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockImplementation(() => {
        subscriptionOrder.push('subscribe');
        return Promise.resolve(() => undefined);
      }),
    };
    render(<App sessions={[]} desktopDeliveryGateway={gateway} />);
    await waitFor(() =>
      expect(subscriptionOrder).toEqual(['subscribe', 'drain']),
    );
    fireEvent.click(screen.getByRole('button', { name: /Open file/i }));
    await screen.findByRole('region', { name: 'notes.txt' });
    expect(choose).toHaveBeenCalledOnce();
    expect(materialize).toHaveBeenCalledOnce();
    const textbox = await screen.findByRole('textbox', {
      name: 'notes.txt text editor',
    });
    act(() =>
      EditorView.findFromDOM(textbox)?.dispatch({
        changes: { from: 0, insert: 'x' },
      }),
    );
    invokeMenu('Save');
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ source_id: 'source', revision: 2 }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /Saved after native verification/i,
      ),
    );
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    await waitFor(() => expect(close).toHaveBeenCalledWith('source'));
  });

  it('projects editor changes into dirty shell state before save is available', () => {
    render(<App sessions={[initialSessions[2]]} />);
    const textbox = screen.getByRole('textbox', {
      name: 'notes.txt text editor',
    });
    const view = EditorView.findFromDOM(textbox);
    expect(view).not.toBeNull();
    act(() => view?.dispatch({ changes: { from: 0, to: 1, insert: 'a' } }));
    expect(screen.getByRole('region', { name: 'notes.txt' })).toHaveTextContent(
      'a small text fixture',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menuitem', { name: 'Save' })).toBeEnabled();
  });

  it('renders semantic compact tabs and an active document surface', async () => {
    render(<App sessions={initialSessions} />);

    expect(
      screen.getByRole('tablist', { name: 'Open documents' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: /welcome\.md/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Glitchpad document foundation',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /more open documents/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports automatic keyboard activation, reorder, cycling, close focus, and overflow', () => {
    render(<App sessions={initialSessions} />);
    const first = screen.getByRole('tab', { name: /welcome\.md/i });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /diagram\.mmd/i })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('tab', { name: /diagram\.mmd/i }), {
      key: 'ArrowRight',
      altKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole('tab', { name: /diagram\.mmd/i })).toHaveFocus();

    fireEvent.keyDown(getApplicationShell(), { key: 'Tab', ctrlKey: true });
    expect(screen.getByRole('tab', { name: /draft\.md/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent(/unsaved changes/i);
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(
      screen.queryByRole('tab', { name: /draft\.md/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /more open documents/i }),
    );
    const menu = screen.getByRole('menu', { name: 'Overflow documents' });
    fireEvent.click(
      within(menu).getByRole('menuitem', { name: /^welcome\.md$/iu }),
    );
    expect(screen.getByRole('tab', { name: /welcome\.md/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('cancels dirty close without changing content and returns keyboard focus', async () => {
    render(<App sessions={[initialSessions[3]]} />);
    const document = screen.getByRole('region', { name: 'draft.md' });
    document.focus();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    ).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document).toHaveFocus();
    expect(
      await screen.findByText('Unsaved fixture content.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/remains open/i);
  });

  it('keeps dirty content open while Save As waits for a durable receipt', async () => {
    render(<App sessions={[initialSessions[3]]} />);
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      /until a durable receipt arrives/i,
    );
    expect(
      await screen.findByText('Unsaved fixture content.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'draft.md' })).toBeVisible();
  });

  it('completes a destructive transition only after native Save As succeeds', async () => {
    const saveAs = vi.fn().mockResolvedValue(true);
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(saveReceipt),
      materialize: vi.fn().mockResolvedValue(null),
      saveAs,
      subscribe: vi.fn().mockResolvedValue(() => undefined),
    };
    render(
      <App sessions={[initialSessions[3]]} desktopDeliveryGateway={gateway} />,
    );
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      /until a durable receipt arrives/i,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'draft.md' }),
      ).not.toBeInTheDocument(),
    );
    expect(saveAs).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft' }),
    );
  });

  it('completes a close only after native in-place Save returns a durable receipt', async () => {
    const session = {
      ...initialSessions[3],
      source_id: 'source',
      external_revision: revision,
    };
    const save = vi.fn((captured: ShellSession) =>
      Promise.resolve({
        ...saveReceipt,
        operation_id: captured.destination_save_operation_id!,
        accepted_session_revision: session.revision,
      }),
    );
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      save,
      materialize: vi.fn().mockResolvedValue(null),
      saveAs: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockResolvedValue(() => undefined),
    };
    render(<App sessions={[session]} desktopDeliveryGateway={gateway} />);
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'draft' }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'draft.md' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('projects conflict messaging and removes unsafe in-place save', () => {
    const conflicted = {
      ...initialSessions[3],
      integrity: 'conflicted' as const,
      source_state: 'changed' as const,
    };
    render(<App sessions={[conflicted]} />);
    expect(screen.getByText(/source changed outside/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Save' }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    const dialog = within(screen.getByRole('dialog'));
    expect(
      dialog.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save As' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('requires an explicit recover or refusal decision for crash inventory', () => {
    const onDecision = vi.fn();
    render(
      <RecoveryCandidateResolution
        entry={{
          record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
          display_hint: 'recovered.txt',
          updated_unix_ms: 10,
          expires_unix_ms: 20,
          committed_bytes: 100,
          status: 'available',
        }}
        onDecision={onDecision}
      />,
    );
    expect(screen.getByRole('button', { name: 'Recover' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Decline recovery' }));
    expect(onDecision).toHaveBeenCalledWith('refuse');
  });

  it('loads native recovery inventory and opens an accepted record as dirty recovery-only', async () => {
    const entry = {
      record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
      display_hint: 'recovered.txt',
      updated_unix_ms: 10,
      expires_unix_ms: 20,
      committed_bytes: 100,
      status: 'available' as const,
    };
    const remove = vi.fn();
    const gateway: RecoveryGateway = {
      inventory: vi.fn().mockResolvedValue([entry]),
      persist: vi.fn(),
      load: vi.fn().mockResolvedValue({
        schema_version: 1,
        record_id: entry.record_id,
        display_hint: entry.display_hint,
        source_identity_hash: 'a'.repeat(64),
        base_revision_hash: 'b'.repeat(64),
        saved_session_revision: 1,
        snapshot_session_revision: 2,
        text_profile: {
          encoding: 'utf8',
          bom: 'absent',
          newlines: 'lf',
          terminal_newline: 'absent',
          undecodable_bytes: 'none',
        },
        created_unix_ms: 5,
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        content: 'Recovered exact content',
        content_sha256: 'c'.repeat(64),
        eviction_eligible: false,
      }),
      remove,
    };

    render(<App sessions={[]} recoveryGateway={gateway} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recover' }));

    expect(
      await screen.findByRole('region', { name: 'recovered.txt' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'recovered.txt' }),
      ).toHaveTextContent('Recovered exact content'),
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('snapshots dirty content after the idle interval without exposing it to errors', async () => {
    vi.useFakeTimers();
    try {
      const persist = vi.fn().mockResolvedValue({
        record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
        display_hint: 'draft.md',
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        committed_bytes: 100,
        status: 'available',
      });
      const gateway: RecoveryGateway = {
        inventory: vi.fn().mockResolvedValue([]),
        persist,
        load: vi.fn(),
        remove: vi.fn(),
      };

      render(<App sessions={[initialSessions[3]]} recoveryGateway={gateway} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(persist).toHaveBeenCalledOnce();
      expect(persist).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '# Draft\n\nUnsaved fixture content.',
          eviction_eligible: false,
          snapshot_session_revision: 1,
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives commands from the active capabilities and reports unavailable execution', async () => {
    render(<App sessions={initialSessions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(
      screen.getByRole('menuitem', { name: /^Copy\b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /save/i }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    fireEvent.click(screen.getByRole('tab', { name: /draft\.md/i }));
    invokeMenu('Save');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /unavailable for the current document/i,
      ),
    );
  });

  it('opens one shell-owned inspector, retargets it with the active tab, and restores opener focus', async () => {
    render(<App sessions={initialSessions} />);
    invokeMenu('File information');
    expect(
      screen.getByRole('complementary', { name: 'File information' }),
    ).toHaveTextContent('welcome.md');
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /diagram\.mmd/iu }));
    expect(
      screen.getByRole('complementary', { name: 'File information' }),
    ).toHaveTextContent('diagram.mmd');
    fireEvent.click(
      screen.getByRole('button', { name: 'Close file information' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus(),
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('refreshes metadata and publishes only a revision-bound checksum', async () => {
    const observedRevision = {
      ...revision,
      byte_length: 4,
      modified_unix_nanos: '2',
      change_token: 'observed',
    };
    const source = {
      ...initialSessions[2],
      lifecycle: 'active' as const,
      source_id: 'source',
      external_revision: revision,
      renderer: {
        ...initialSessions[2].renderer,
        capabilities: {
          ...initialSessions[2].renderer.capabilities,
          inspect_metadata: true,
        },
      },
    };
    const advanceIntegrity = vi.fn((requestId: string) =>
      Promise.resolve({
        request_id: requestId,
        source_id: 'source',
        external_revision: observedRevision,
        processed_bytes: '4',
        total_bytes: '4',
        state: 'ready' as const,
        sha256: 'a'.repeat(64),
      }),
    );
    const startIntegrity = vi.fn((request: IntegrityStartRequest) =>
      Promise.resolve({
        request_id: request.request_id,
        source_id: 'source',
        external_revision: request.expected_external_revision,
        processed_bytes: '0',
        total_bytes: '4',
        state: 'pending' as const,
        sha256: null,
      }),
    );
    const gateway: MetadataGateway = {
      query: vi.fn(() =>
        Promise.resolve({
          source_id: 'source',
          external_revision: observedRevision,
          display_name: 'refreshed.txt',
          source_kind: 'file' as const,
          byte_length: '4',
          modified_unix_nanos: '2',
          created_unix_nanos: null,
          accessed_unix_nanos: null,
          write_state: 'writable' as const,
          identity_confidence: 'strong' as const,
        }),
      ),
      startIntegrity,
      advanceIntegrity,
      cancelIntegrity: vi.fn(() => Promise.resolve()),
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    invokeMenu('File information');
    await waitFor(() =>
      expect(screen.getByRole('complementary')).toHaveTextContent(
        'refreshed.txt',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Calculate SHA-256' }));
    expect(await screen.findByText('a'.repeat(64))).toBeInTheDocument();
    expect(advanceIntegrity).toHaveBeenCalled();
    expect(startIntegrity).toHaveBeenCalledWith(
      expect.objectContaining({ expected_external_revision: observedRevision }),
      expect.any(AbortSignal),
    );
  });

  it('withdraws cached source facts and checksum actions when metadata polling fails', async () => {
    const source = {
      ...initialSessions[2],
      lifecycle: 'active' as const,
      source_id: 'source',
      external_revision: revision,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        source_id: 'source',
        external_revision: revision,
        display_name: 'observed.txt',
        source_kind: 'file' as const,
        byte_length: '3',
        modified_unix_nanos: '1',
        created_unix_nanos: null,
        accessed_unix_nanos: null,
        write_state: 'writable' as const,
        identity_confidence: 'strong' as const,
      })
      .mockRejectedValue(new Error('source unavailable'));
    const gateway: MetadataGateway = {
      query,
      startIntegrity: vi.fn(),
      advanceIntegrity: vi.fn(),
      cancelIntegrity: vi.fn(() => Promise.resolve()),
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    invokeMenu('File information');
    expect(
      await screen.findByRole('button', { name: 'Calculate SHA-256' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2), {
      timeout: 2_000,
    });
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('status')
          .some((status) =>
            status.textContent?.includes('Source facts are unavailable'),
          ),
      ).toBe(true),
    );
    expect(
      screen.queryByRole('button', { name: 'Calculate SHA-256' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText('Unavailable (metadata_unavailable)').length,
    ).toBeGreaterThan(0);
  });

  it('cancels native checksum work immediately when the inspector closes', async () => {
    const source = {
      ...initialSessions[2],
      lifecycle: 'active' as const,
      source_id: 'source',
      external_revision: revision,
    };
    const cancelIntegrity = vi.fn(() => Promise.resolve());
    const advanceIntegrity = vi.fn(
      () => new Promise<IntegrityProgress>(() => undefined),
    );
    const gateway: MetadataGateway = {
      query: vi.fn(() =>
        Promise.resolve({
          source_id: 'source',
          external_revision: revision,
          display_name: 'notes.txt',
          source_kind: 'file' as const,
          byte_length: '3',
          modified_unix_nanos: '1',
          created_unix_nanos: null,
          accessed_unix_nanos: null,
          write_state: 'writable' as const,
          identity_confidence: 'strong' as const,
        }),
      ),
      startIntegrity: vi.fn((request: IntegrityStartRequest) =>
        Promise.resolve({
          request_id: request.request_id,
          source_id: 'source',
          external_revision: revision,
          processed_bytes: '0',
          total_bytes: '3',
          state: 'pending' as const,
          sha256: null,
        }),
      ),
      advanceIntegrity,
      cancelIntegrity,
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    invokeMenu('File information');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Calculate SHA-256' }),
    );
    await waitFor(() => expect(advanceIntegrity).toHaveBeenCalled());
    fireEvent.click(
      screen.getByRole('button', { name: 'Close file information' }),
    );
    await waitFor(() => expect(cancelIntegrity).toHaveBeenCalledOnce());
  });

  it('keeps the reference document area at or above 90 percent', () => {
    expect(DESKTOP_CHROME_MAX_PX).toBeLessThanOrEqual(
      REFERENCE_HEIGHT_PX * 0.1,
    );
  });

  it('has no critical or serious automated accessibility findings', async () => {
    const { container } = render(
      <App sessions={initialSessions.slice(0, 2)} />,
    );
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);
  });

  it('loads, edits, persists, and resets bounded preferences without replacing the document', async () => {
    const gateway = persistenceGateway();
    render(
      <App sessions={[initialSessions[2]]} persistenceGateway={gateway} />,
    );
    invokeMenu('Preferences');
    expect(
      screen.getByRole('complementary', { name: 'Preferences' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'notes.txt' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Theme'), {
      target: { value: 'dark' },
    });
    await waitFor(
      () =>
        expect(gateway.persistPreferences).toHaveBeenCalledWith(
          expect.objectContaining({ theme: 'dark' }),
        ),
      { timeout: 1_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    await waitFor(() =>
      expect(gateway.reset).toHaveBeenCalledWith('preferences'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close preferences' }));
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('previews the exact redacted diagnostic bundle before explicit export', async () => {
    const gateway = persistenceGateway();
    const exporter = { export: vi.fn().mockResolvedValue(undefined) };
    render(
      <App
        sessions={[initialSessions[2]]}
        persistenceGateway={gateway}
        diagnosticExportGateway={exporter}
      />,
    );
    invokeMenu('Diagnostics');
    expect(
      await screen.findByText(/"generated_unix_ms": 42/u),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
    expect(exporter.export).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Export previewed bundle' }),
    );
    expect(exporter.export).toHaveBeenCalledWith(
      expect.objectContaining({ generated_unix_ms: 42 }),
    );
  });

  it('applies loaded window, active-session, native-reference, and presentation projections', async () => {
    const restorable = initialSessions.slice(0, 2).map((session, index) => ({
      ...session,
      source: {
        ...session.source,
        restoration_reference: `00000000-0000-4000-8000-00000000000${index}`,
      },
    }));
    const gateway = persistenceGateway({
      loadPreferences: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: { ...defaultPreferences(), markdown_default_mode: 'source' },
        warning_code: null,
      }),
      loadSession: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: {
          schema_version: 1,
          window: { active_session_index: 1, inspector: 'preferences' },
          sessions: restorable.map((session, index) => ({
            session_key: `previous-${index}`,
            display_hint: session.source.display_name,
            renderer_id: session.renderer.id,
            presentation_mode: 'source',
            source_reference: session.source.restoration_reference,
            recovery_record_id: null,
          })),
        },
        warning_code: null,
      }),
    });
    render(<App sessions={restorable} persistenceGateway={gateway} />);

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: /diagram\.mmd/iu }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
    expect(
      screen.getByRole('complementary', { name: 'Preferences' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Menu' }),
    ).not.toBeInTheDocument();
  });

  it('invokes Android restoration before matching a loaded native projection', async () => {
    const sourceReference = '70cbf05c-53f5-5442-9ace-9d576529714c';
    const restoredSession = {
      ...initialSessions[0],
      id: 'restored-native-source',
      lifecycle: 'background' as const,
      source_id: 'native-source',
      source: {
        ...initialSessions[0].source,
        restoration_reference: sourceReference,
      },
    };
    const restore = vi
      .fn<AndroidRestorationGateway['restore']>()
      .mockResolvedValue([restoredSession]);
    const androidGateway: AndroidRestorationGateway = { restore };
    const gateway = persistenceGateway({
      loadSession: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: {
          schema_version: 1,
          window: { active_session_index: 0, inspector: 'closed' },
          sessions: [
            {
              session_key: 'old-process-session-1',
              display_hint: 'welcome.md',
              renderer_id: 'markdown',
              presentation_mode: 'rendered',
              source_reference: sourceReference,
              recovery_record_id: null,
            },
          ],
        },
        warning_code: null,
      }),
    });

    render(
      <App
        sessions={[]}
        persistenceGateway={gateway}
        androidRestorationGateway={androidGateway}
      />,
    );

    expect(
      await screen.findByRole('region', { name: 'welcome.md' }),
    ).toBeVisible();
    expect(restore).toHaveBeenCalledWith([
      expect.objectContaining({ source_reference: sourceReference }),
    ]);
  });

  it('uses a minimal empty surface after all fixture sessions close', () => {
    render(<App sessions={initialSessions.slice(0, 1)} />);
    fireEvent.keyDown(getApplicationShell(), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('No document is open');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
