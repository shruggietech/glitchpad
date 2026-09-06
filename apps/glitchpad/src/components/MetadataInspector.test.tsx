import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { initialSessions } from '../App';
import { MemoryClipboardGateway } from '../domain/metadata-gateway';
import {
  projectSessionMetadata,
  type MetadataFact,
} from '../domain/metadata';
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
    const states = ['available', 'not_provided', 'unsupported', 'redacted', 'pending', 'errored'] as const;
    snapshot.facts = snapshot.facts.map((fact, index) => index < states.length
      ? stateFact(fact, states[index])
      : fact);
    render(<MetadataInspector session={session} snapshot={snapshot} onClose={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'File information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Source' })).toBeInTheDocument();
    expect(screen.getAllByText('Host source').length).toBeGreaterThan(0);
    for (const label of ['Not provided', 'Unsupported', 'Redacted', 'Pending', 'Unavailable (metadata_error)'])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('dismisses with Escape and initially focuses the close action', async () => {
    const close = vi.fn();
    render(<MetadataInspector session={session} snapshot={projectSessionMetadata(session)} onClose={close} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close file information' })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('copies direct values, requires per-fact sensitive confirmation, excludes protected values from bulk, and bounds clipboard failures', async () => {
    const clipboard = new MemoryClipboardGateway();
    const snapshot = projectSessionMetadata(session);
    snapshot.facts = snapshot.facts.map((fact) => fact.key === 'derived.warnings'
      ? { ...fact, availability: 'available' as const, value: { kind: 'text' as const, value: 'private warning' } }
      : fact);
    const { rerender } = render(<MetadataInspector session={session} snapshot={snapshot} onClose={vi.fn()} clipboardGateway={clipboard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy File name' }));
    await waitFor(() => expect(clipboard.value).toBe('diagram.mmd'));
    fireEvent.click(screen.getByRole('button', { name: 'Disclose External revision' }));
    expect(screen.getByText(/Copying this value may expose source identity/iu)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy External revision' }));
    await waitFor(() => expect(clipboard.value).toContain('42'));
    expect(screen.queryByRole('button', { name: 'Copy Warnings' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy available information' }));
    await waitFor(() => expect(clipboard.value).not.toContain('private warning'));
    expect(clipboard.value).not.toContain('External revision');

    rerender(<MetadataInspector session={session} snapshot={snapshot} onClose={vi.fn()} clipboardGateway={{ write: () => Promise.reject(new Error('path C:\\private')) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy File name' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copy failed'));
    expect(screen.getByRole('status')).not.toHaveTextContent('private');
  });

  it('has no critical or serious accessibility findings', async () => {
    const { container } = render(<MetadataInspector session={session} snapshot={projectSessionMetadata(session)} onClose={vi.fn()} />);
    const result = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    expect(result.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });

  it('announces asynchronous fact changes once without narrating values and supports phone expansion', async () => {
    const snapshot = projectSessionMetadata(session);
    const { rerender } = render(<MetadataInspector session={session} snapshot={snapshot} onClose={vi.fn()} />);
    const expand = screen.getByRole('button', { name: 'Expand information' });
    fireEvent.click(expand);
    expect(screen.getByRole('complementary')).toHaveAttribute('data-phone-expanded', 'true');
    const changed = {
      ...snapshot,
      facts: snapshot.facts.map((fact) => fact.key === 'host.byte_length'
        ? { ...fact, value: { kind: 'integer' as const, value: '9007199254740993' } }
        : fact),
    };
    rerender(<MetadataInspector session={session} snapshot={changed} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('File information updated.'));
    expect(screen.getByRole('status')).not.toHaveTextContent('9007199254740993');
  });
});

const stateFact = (fact: MetadataFact, availability: MetadataFact['availability']): MetadataFact => ({
  ...fact,
  availability,
  value: availability === 'available' ? { kind: 'text', value: 'Available value' } : undefined,
  error_code: availability === 'errored' ? 'metadata_error' : undefined,
});
