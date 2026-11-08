import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { initialSessions } from '../test/fixtures';
import { MemoryClipboardGateway } from '../domain/metadata-gateway';
import { projectSessionMetadata, type MetadataFact } from '../domain/metadata';
import { MetadataInspector } from './MetadataInspector';

const session = {
  ...initialSessions[1],
  source_id: 'source',
  external_revision: {
    identity: initialSessions[1].source.identity,
    byte_length: 42,
    modified_unix_nanos: '1788044400000000000',
    change_token: null,
  },
};

describe('metadata inspector', () => {
  it('groups facts, exposes provenance and renders all six availability labels', () => {
    const snapshot = projectSessionMetadata(session);
    const states = [
      'available',
      'not_provided',
      'unsupported',
      'redacted',
      'pending',
      'errored',
    ] as const;
    snapshot.facts = snapshot.facts.map((fact, index) =>
      index < states.length ? stateFact(fact, states[index]) : fact,
    );
    render(
      <MetadataInspector
        session={session}
        snapshot={snapshot}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('complementary', { name: 'File information' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Source' })).toBeInTheDocument();
    expect(screen.getAllByText('Host source').length).toBeGreaterThan(0);
    for (const label of [
      'Not provided',
      'Unsupported',
      'Redacted',
      'Pending',
      'Unavailable (metadata_error)',
    ])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('dismisses with Escape and initially focuses the close action', async () => {
    const close = vi.fn();
    render(
      <MetadataInspector
        session={session}
        snapshot={projectSessionMetadata(session)}
        onClose={close}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close file information' }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('copies direct values, requires per-fact sensitive confirmation, excludes protected values from bulk, and bounds clipboard failures', async () => {
    const clipboard = new MemoryClipboardGateway();
    const snapshot = projectSessionMetadata(session);
    snapshot.facts = snapshot.facts.map((fact) =>
      fact.key === 'derived.warnings'
        ? {
            ...fact,
            availability: 'available' as const,
            value: { kind: 'text' as const, value: 'private warning' },
          }
        : fact,
    );
    const { rerender } = render(
      <MetadataInspector
        session={session}
        snapshot={snapshot}
        onClose={vi.fn()}
        clipboardGateway={clipboard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy File name' }));
    await waitFor(() => expect(clipboard.value).toBe('diagram.mmd'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Disclose External revision' }),
    );
    expect(
      screen.getByText(/Copying this value may expose source identity/iu),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy External revision' }),
    );
    await waitFor(() => expect(clipboard.value).toContain('42'));
    expect(
      screen.queryByRole('button', { name: 'Copy Warnings' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy available information' }),
    );
    await waitFor(() =>
      expect(clipboard.value).not.toContain('private warning'),
    );
    expect(clipboard.value).not.toContain('External revision');

    rerender(
      <MetadataInspector
        session={session}
        snapshot={snapshot}
        onClose={vi.fn()}
        clipboardGateway={{
          write: () => Promise.reject(new Error('path C:\\private')),
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy File name' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed'),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('private');
  });

  it('has no critical or serious accessibility findings', async () => {
    const { container } = render(
      <MetadataInspector
        session={session}
        snapshot={projectSessionMetadata(session)}
        onClose={vi.fn()}
      />,
    );
    const result = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      result.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);
  });

  it('announces asynchronous fact changes once without narrating values and supports phone expansion', async () => {
    const snapshot = projectSessionMetadata(session);
    const { rerender } = render(
      <MetadataInspector
        session={session}
        snapshot={snapshot}
        onClose={vi.fn()}
      />,
    );
    const expand = screen.getByRole('button', { name: 'Expand information' });
    fireEvent.click(expand);
    expect(screen.getByRole('complementary')).toHaveAttribute(
      'data-phone-expanded',
      'true',
    );
    const changed = {
      ...snapshot,
      facts: snapshot.facts.map((fact) =>
        fact.key === 'host.byte_length'
          ? {
              ...fact,
              value: { kind: 'integer' as const, value: '9007199254740993' },
            }
          : fact,
      ),
    };
    rerender(
      <MetadataInspector
        session={session}
        snapshot={changed}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'File information updated.',
      ),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(
      '9007199254740993',
    );
  });
});

const stateFact = (
  fact: MetadataFact,
  availability: MetadataFact['availability'],
): MetadataFact => ({
  ...fact,
  availability,
  value:
    availability === 'available'
      ? { kind: 'text', value: 'Available value' }
      : undefined,
  error_code: availability === 'errored' ? 'metadata_error' : undefined,
});

describe('metadata confirmation lifetime', () => {
  it('returns Cancel focus to the same disclosure without writing clipboard', async () => {
    const clipboard = new MemoryClipboardGateway();
    render(
      <MetadataInspector
        session={session}
        snapshot={projectSessionMetadata(session)}
        clipboardGateway={clipboard}
        onClose={vi.fn()}
      />,
    );
    const disclose = screen.getByRole('button', {
      name: 'Disclose External revision',
    });
    fireEvent.click(disclose);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Disclose External revision' }),
      ).toHaveFocus(),
    );
    expect(clipboard.value).toBe('');
  });
  it('withdraws sensitive confirmation when its current value changes', () => {
    const snapshot = projectSessionMetadata(session);
    const { rerender } = render(
      <MetadataInspector
        session={session}
        snapshot={snapshot}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Disclose External revision' }),
    );
    const changed = {
      ...snapshot,
      facts: snapshot.facts.map((fact) =>
        fact.key === 'source.external_revision'
          ? { ...fact, value: { kind: 'text' as const, value: 'changed' } }
          : fact,
      ),
    };
    // The source's external revision fact is the disclosure authority.
    const key = snapshot.facts.find(
      (fact) =>
        fact.key.includes('revision') && fact.availability === 'available',
    )!.key;
    changed.facts = snapshot.facts.map((fact) =>
      fact.key === key
        ? { ...fact, value: { kind: 'text' as const, value: 'changed' } }
        : fact,
    );
    rerender(
      <MetadataInspector
        session={session}
        snapshot={changed}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Copy External revision' }),
    ).not.toBeInTheDocument();
  });
});

describe('metadata task expansion', () => {
  it('requests actual host expansion and collapse while keeping the displayed current facts', () => {
    const changed = vi.fn();
    render(
      <MetadataInspector
        embedded
        session={session}
        snapshot={projectSessionMetadata(session)}
        onClose={vi.fn()}
        onExpandedChange={changed}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand information' }));
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole('button', { name: 'Collapse information' }),
    ).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse information' }),
    );
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(
      screen.getByRole('button', { name: 'Expand information' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary')).toHaveTextContent('diagram.mmd');
  });
  it('ignores an old clipboard receipt after the current document changes', async () => {
    let finish!: () => void;
    const clipboardGateway = {
      write: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    };
    const { rerender } = render(
      <MetadataInspector
        session={session}
        snapshot={projectSessionMetadata(session)}
        clipboardGateway={clipboardGateway}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy File name' }));
    expect(screen.getByRole('status')).toHaveTextContent('Copying information');
    const next = {
      ...session,
      id: 'new-owner',
      source: { ...session.source, display_name: 'next.md' },
    };
    rerender(
      <MetadataInspector
        session={next}
        snapshot={projectSessionMetadata(next)}
        clipboardGateway={clipboardGateway}
        onClose={vi.fn()}
      />,
    );
    finish();
    await waitFor(() =>
      expect(screen.getByRole('status')).not.toHaveTextContent(
        'File name copied',
      ),
    );
    expect(screen.getByRole('complementary')).toHaveTextContent('next.md');
  });
});

it('reports a failed bulk copy without replacing facts or exposing the clipboard error', async () => {
  const write = vi.fn(() =>
    Promise.reject(new Error('private clipboard backend')),
  );
  render(
    <MetadataInspector
      session={session}
      snapshot={projectSessionMetadata(session)}
      onClose={vi.fn()}
      clipboardGateway={{ write }}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Copy available information' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Copy failed'),
  );
  expect(write).toHaveBeenCalledOnce();
  expect(screen.getByRole('status')).not.toHaveTextContent('private');
  expect(screen.getByRole('button', { name: 'Copy File name' })).toBeEnabled();
  expect(screen.getAllByText('diagram.mmd').length).toBeGreaterThan(0);
});
