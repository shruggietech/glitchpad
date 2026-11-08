import { AppFrame } from '../../../../brand/web/react/server';
import {
  act,
  fireEvent,
  render as renderView,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRef, type ReactElement } from 'react';
import type { TextEditorHandle } from './TextEditorSurface';

import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from '../domain/contracts';
import { MemoryLargeTextGateway } from '../domain/large-text-gateway';
import { LARGE_TEXT_WINDOW_BYTES } from '../domain/large-text';
import { createTextDocument } from '../domain/text-document';
import { LargeTextSurface } from './LargeTextSurface';

const render = (ui: ReactElement) => renderView(ui, { wrapper: AppFrame });

const bytes = new TextEncoder().encode(
  `${'first line\n'.repeat(30_000)}target\n${'tail\n'.repeat(50_000)}`,
);
const session: ShellSession = {
  id: 'large',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'tests',
      token: 'large',
      strength: 'strong',
    },
    display_name: 'large.log',
    claimed_media_type: 'text/plain',
    byte_length: bytes.byteLength,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: { ...noSourceCapabilities(), read: true, seek: true },
  },
  renderer: {
    id: 'text',
    label: 'Text',
    capabilities: {
      ...noRendererCapabilities(),
      view: true,
      search: true,
      copy: true,
      navigate: true,
    },
  },
  lifecycle: 'active',
  dirty: false,
  revision: 1,
  content: '',
  source_id: 'large-source',
  text_document: createTextDocument({
    rawText: '',
    displayName: 'large.log',
    sourceBytes: 33 * 1024 * 1024,
  }),
};

const openLargeTools = (ref: { readonly current: TextEditorHandle | null }) => {
  if (!screen.queryByRole('dialog', { name: 'Large text tools' })) {
    act(() => {
      expect(ref.current!.invoke('large_text_tools')).toBe(true);
    });
  }
};

describe('LargeTextSurface', () => {
  it('drops old content when a replacement document has no source authority', async () => {
    const { rerender } = render(
      <LargeTextSurface
        session={session}
        gateway={new MemoryLargeTextGateway('large-source', bytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    rerender(
      <LargeTextSurface
        session={{ ...session, id: 'unavailable', source_id: null }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Large text source authority is unavailable',
    );
    expect(screen.queryByText(/first line/)).not.toBeInTheDocument();
  });
  it('preserves the current window when a shared navigation read fails', async () => {
    const ref = createRef<TextEditorHandle>();
    const source = new MemoryLargeTextGateway('large-source', bytes);
    let denied = false;
    const gateway = {
      read: vi.fn((sourceId: string, offset: number, length: number) =>
        denied
          ? Promise.reject(new Error('read denied'))
          : source.read(sourceId, offset, length),
      ),
    };
    render(<LargeTextSurface ref={ref} session={session} gateway={gateway} />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    denied = true;
    await act(async () => {
      await expect(ref.current!.invoke('next_page')).rejects.toThrow(
        'read denied',
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Large text window could not be decoded safely',
    );
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    openLargeTools(ref);
    expect(
      screen.getByRole('button', { name: 'Previous section' }),
    ).toBeDisabled();
  });
  it('executes shared window navigation and exposes read/clipboard failures', async () => {
    const ref = createRef<TextEditorHandle>();
    render(
      <LargeTextSurface
        ref={ref}
        session={session}
        gateway={new MemoryLargeTextGateway('large-source', bytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    expect(ref.current).not.toBeNull();
    await act(async () => {
      expect(await ref.current!.invoke('next_page')).toBe(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/end of source/i);
    await act(async () => {
      expect(await ref.current!.invoke('next_page')).toBe(false);
    });
    await act(async () => {
      expect(await ref.current!.invoke('previous_page')).toBe(true);
    });
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(() => Promise.reject(new Error('clipboard denied'))),
      },
    });
    try {
      await act(async () => {
        await expect(ref.current!.invoke('copy')).rejects.toThrow(
          'clipboard denied',
        );
      });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
  it('loads bounded source-backed content and offers read-only search and navigation', async () => {
    const ref = createRef<TextEditorHandle>();
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    render(<LargeTextSurface ref={ref} session={session} gateway={gateway} />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /read-only|end of source/i,
      ),
    );
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    expect(gateway.requests.every(({ length }) => length <= 256 * 1024)).toBe(
      true,
    );
    openLargeTools(ref);
    fireEvent.change(screen.getByLabelText('Find'), {
      target: { value: 'target' },
    });
    openLargeTools(ref);
    fireEvent.click(screen.getByRole('button', { name: 'Find next' }));
    await waitFor(() => expect(screen.getByText(/target/)).toBeInTheDocument());
    expect(
      screen.queryByRole('textbox', { name: /text editor/i }),
    ).not.toBeInTheDocument();
  });

  it('returns from a partial final window to the actual preceding window', async () => {
    const ref = createRef<TextEditorHandle>();
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    const { container } = render(
      <LargeTextSurface ref={ref} session={session} gateway={gateway} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    openLargeTools(ref);
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/end of source/i),
    );
    openLargeTools(ref);
    fireEvent.click(screen.getByRole('button', { name: 'Previous section' }));
    await waitFor(() =>
      expect(
        container.querySelector('.large-text-content')?.textContent,
      ).toMatch(/^first line/),
    );
  });

  it('advances across large-source matches and wraps after the final match', async () => {
    const ref = createRef<TextEditorHandle>();
    const repeatedBytes = new TextEncoder().encode(
      `target${'x'.repeat(LARGE_TEXT_WINDOW_BYTES)}target`,
    );
    const repeatedSession: ShellSession = {
      ...session,
      source: { ...session.source, byte_length: repeatedBytes.byteLength },
    };
    render(
      <LargeTextSurface
        ref={ref}
        session={repeatedSession}
        gateway={new MemoryLargeTextGateway('large-source', repeatedBytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    openLargeTools(ref);
    fireEvent.change(screen.getByLabelText('Find'), {
      target: { value: 'target' },
    });
    const find = screen.getByRole('button', { name: 'Find next' });
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 1 of 2'),
    );
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 2 of 2'),
    );
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 1 of 2'),
    );
  });
});

describe('large-text task results', () => {
  it('rejects invalid line drafts without reading or moving the current section', async () => {
    const ref = createRef<TextEditorHandle>();
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    const { container } = render(
      <LargeTextSurface ref={ref} session={session} gateway={gateway} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    const before = container.querySelector('.large-text-content')?.textContent;
    const reads = gateway.requests.length;
    openLargeTools(ref);
    const line = screen.getByLabelText('Line');
    for (const value of ['', '0', '-1', '1.5', 'not-a-line']) {
      fireEvent.change(line, { target: { value } });
      openLargeTools(ref);
      fireEvent.click(screen.getByRole('button', { name: 'Go to line' }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Enter a positive whole line number.',
        ),
      );
      expect(container.querySelector('.large-text-content')?.textContent).toBe(
        before,
      );
    }
    expect(gateway.requests).toHaveLength(reads);
    openLargeTools(ref);
    expect(
      screen.getByRole('button', { name: 'Previous section' }),
    ).toBeDisabled();
  });
  it('reports unavailable clipboard for exactly the displayed section', async () => {
    const ref = createRef<TextEditorHandle>();
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    try {
      render(
        <LargeTextSurface
          ref={ref}
          session={session}
          gateway={new MemoryLargeTextGateway('large-source', bytes)}
        />,
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
      );
      openLargeTools(ref);
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy visible section' }),
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Clipboard is unavailable. The visible section remains open.',
        ),
      );
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

describe('large-text pending operation ownership', () => {
  it('cancels a pending section read and ignores its late completion while keeping current bytes', async () => {
    const ref = createRef<TextEditorHandle>();
    const source = new MemoryLargeTextGateway('large-source', bytes);
    let finish!: () => void;
    let hold = false;
    const gateway = {
      read: async (id: string, offset: number, length: number) => {
        if (hold)
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        return source.read(id, offset, length);
      },
    };
    const { container } = render(
      <LargeTextSurface ref={ref} session={session} gateway={gateway} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    const before = container.querySelector('.large-text-content')?.textContent;
    hold = true;
    openLargeTools(ref);
    fireEvent.click(screen.getByRole('button', { name: 'Next section' }));
    await screen.findByRole('button', { name: 'Cancel text operation' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel text operation' }),
    );
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(container.querySelector('.large-text-content')?.textContent).toBe(
      before,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Text operation cancelled. The current section remains open.',
    );
  });
  it('copies exactly the displayed section and reports a line outside the source without moving it', async () => {
    const ref = createRef<TextEditorHandle>();
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      const { container } = render(
        <LargeTextSurface
          ref={ref}
          session={session}
          gateway={new MemoryLargeTextGateway('large-source', bytes)}
        />,
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
      );
      const visible = container.querySelector(
        '.large-text-content',
      )?.textContent;
      openLargeTools(ref);
      fireEvent.click(
        screen.getByRole('button', { name: 'Copy visible section' }),
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Visible section copied',
        ),
      );
      expect(writeText).toHaveBeenCalledExactlyOnceWith(visible);
      openLargeTools(ref);
      fireEvent.change(screen.getByLabelText('Line'), {
        target: { value: '9999999' },
      });
      openLargeTools(ref);
      fireEvent.click(screen.getByRole('button', { name: 'Go to line' }));
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Line is outside the source',
        ),
      );
      expect(container.querySelector('.large-text-content')?.textContent).toBe(
        visible,
      );
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

describe('bounded large-file tools', () => {
  it('discloses all tools in a modal and retains the query and visible bytes on close', async () => {
    const ref = createRef<TextEditorHandle>();
    const { container } = render(
      <LargeTextSurface
        ref={ref}
        session={session}
        gateway={new MemoryLargeTextGateway('large-source', bytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    const before = container.querySelector('.large-text-content')?.textContent;
    expect(screen.queryByLabelText('Find')).not.toBeInTheDocument();
    openLargeTools(ref);
    expect(
      await screen.findByRole('dialog', { name: 'Large text tools' }),
    ).toHaveAttribute('aria-modal', 'true');
    fireEvent.change(screen.getByLabelText('Find'), {
      target: { value: 'target' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Large text tools' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(container.querySelector('.large-text-content')?.textContent).toBe(
      before,
    );
    openLargeTools(ref);
    expect(screen.getByLabelText('Find')).toHaveValue('target');
  });
});

describe('large text focus action ownership', () => {
  it('retains current Search through metadata refresh and rejects an inactive owner', async () => {
    const ref = createRef<TextEditorHandle>();
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    const view = render(
      <LargeTextSurface ref={ref} session={session} gateway={gateway} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    let outcome: boolean | Promise<boolean> | undefined;
    act(() => {
      outcome = ref.current!.invoke('search');
    });
    view.rerender(
      <LargeTextSurface
        ref={ref}
        session={{
          ...session,
          source: { ...session.source, modified_unix_ms: 12 },
        }}
        gateway={gateway}
      />,
    );
    await act(async () => {
      expect(await outcome).toBe(true);
    });
    expect(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Large text tools' }),
    );
    act(() => {
      outcome = ref.current!.invoke('search');
    });
    view.rerender(
      <LargeTextSurface
        ref={ref}
        session={{ ...session, lifecycle: 'background' }}
        gateway={gateway}
      />,
    );
    await act(async () => {
      expect(await outcome).toBe(false);
    });
  });
});

it('announces real search progress and retains current bytes after search and Go read failures', async () => {
  const ref = createRef<TextEditorHandle>();
  const source = new MemoryLargeTextGateway('large-source', bytes);
  let failure: 'none' | 'hold' | 'reject' = 'none';
  let rejectRead!: (reason: Error) => void;
  let blocked = false;
  const gateway = {
    read: vi.fn((id: string, offset: number, length: number) => {
      if (failure === 'reject')
        return Promise.reject(new Error('private provider failure'));
      if (failure === 'hold')
        return new Promise<Awaited<ReturnType<typeof source.read>>>(
          (_resolve, reject) => {
            blocked = true;
            rejectRead = reject;
          },
        );
      return source.read(id, offset, length);
    }),
  };
  const { container } = render(
    <LargeTextSurface ref={ref} session={session} gateway={gateway} />,
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
  );
  const visible = container.querySelector('.large-text-content')!.textContent;
  openLargeTools(ref);
  fireEvent.change(screen.getByLabelText('Find'), {
    target: { value: 'missing' },
  });
  failure = 'hold';
  fireEvent.click(screen.getByRole('button', { name: 'Find next' }));
  await waitFor(() => expect(blocked).toBe(true));
  expect(screen.getByRole('status')).toHaveTextContent('Searching source');
  expect(
    screen.getByRole('button', { name: 'Cancel text operation' }),
  ).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Find next' })).toBeDisabled();
  await act(async () => {
    rejectRead(new Error('private provider failure'));
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Text search could not complete',
    ),
  );
  expect(screen.getByRole('status')).not.toHaveTextContent('private');
  expect(container.querySelector('.large-text-content')!.textContent).toBe(
    visible,
  );
  failure = 'reject';
  fireEvent.change(screen.getByLabelText('Line'), {
    target: { value: '40000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Go to line' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Line navigation could not complete',
    ),
  );
  expect(screen.getByRole('status')).not.toHaveTextContent('private');
  expect(container.querySelector('.large-text-content')!.textContent).toBe(
    visible,
  );
  expect(
    screen.getByRole('button', { name: 'Previous section' }),
  ).toBeDisabled();
});

it('keeps successful line-navigation focus inside the open tools modal', async () => {
  const ref = createRef<TextEditorHandle>();
  const { container } = render(
    <LargeTextSurface
      ref={ref}
      session={session}
      gateway={new MemoryLargeTextGateway('large-source', bytes)}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
  );
  openLargeTools(ref);
  const line = screen.getByLabelText('Line');
  const content = container.querySelector<HTMLPreElement>(
    '.large-text-content',
  )!;
  const backgroundFocus = vi.spyOn(content, 'focus');
  try {
    line.focus();
    fireEvent.change(line, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go to line' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Line 2 is at the start of the visible section.',
      ),
    );
    await waitFor(() => expect(line).toHaveFocus());
    expect(backgroundFocus).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('dialog', { name: 'Large text tools' })
        .contains(document.activeElement),
    ).toBe(true);
  } finally {
    backgroundFocus.mockRestore();
  }
});

it('restores the tool field after asynchronous Copy temporarily disables it', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let finishCopy!: () => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve;
        }),
    },
  });
  try {
    const ref = createRef<TextEditorHandle>();
    render(
      <LargeTextSurface
        ref={ref}
        session={session}
        gateway={new MemoryLargeTextGateway('large-source', bytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    openLargeTools(ref);
    const line = screen.getByLabelText('Line');
    line.focus();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy visible section' }),
    );
    await waitFor(() => expect(line).toBeDisabled());
    line.blur();
    await act(async () => {
      finishCopy();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Visible section copied',
      ),
    );
    expect(line).toHaveFocus();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});
