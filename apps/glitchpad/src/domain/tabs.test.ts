import { describe, expect, it } from 'vitest';

import type { ShellSession } from './contracts';
import { createTabState, projectTabs, tabReducer } from './tabs';

const sessions = (count: number): ShellSession[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `session-${index + 1}`,
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'tests',
        token: String(index),
        strength: 'strong',
      },
      display_name: `document-${index + 1}.md`,
      claimed_media_type: 'text/markdown',
      byte_length: 10,
      modified_unix_ms: null,
      kind: 'memory',
      capabilities: {
        read: true,
        seek: false,
        stream: false,
        metadata: false,
        observe_revision: false,
        watch: false,
        revalidate: false,
        write: false,
        replace_atomically: false,
        reopen: false,
        persistent_permission: false,
        rename: false,
        observe_deletion: false,
        reveal_location: false,
      },
    },
    renderer: {
      id: 'markdown',
      label: 'Markdown',
      capabilities: {
        view: true,
        edit: false,
        navigate: false,
        search: false,
        zoom: false,
        copy: true,
        save: false,
        inspect_metadata: false,
      },
    },
    lifecycle: index === 0 ? 'active' : 'background',
    dirty: index === 1,
    revision: 1,
    content: `Document ${index + 1}`,
  }));

describe('tab state', () => {
  it('activates, cycles, reorders, and closes with a deterministic successor', () => {
    let state = createTabState(sessions(4));
    state = tabReducer(state, { type: 'activate', id: 'session-2' });
    expect(state.activeId).toBe('session-2');
    expect(state.sessions[0]?.lifecycle).toBe('background');

    state = tabReducer(state, { type: 'next' });
    expect(state.activeId).toBe('session-3');
    state = tabReducer(state, { type: 'previous' });
    expect(state.activeId).toBe('session-2');

    state = tabReducer(state, { type: 'reorder', id: 'session-2', offset: 1 });
    expect(state.sessions.map(({ id }) => id)).toEqual([
      'session-1',
      'session-3',
      'session-2',
      'session-4',
    ]);
    state = tabReducer(state, { type: 'close', id: 'session-2' });
    expect(state.pendingTransition?.target_session_id).toBe('session-2');
    expect(state.sessions.some(({ id }) => id === 'session-2')).toBe(true);
    state = tabReducer(state, {
      type: 'resolve_transition',
      decision: 'discard',
    });
    expect(state.activeId).toBe('session-4');
    expect(state.sessions.find(({ id }) => id === 'session-4')?.lifecycle).toBe(
      'active',
    );
  });

  it('guards dirty background and overflow closes without changing focus or integrity', () => {
    let state = createTabState(sessions(8));
    state = tabReducer(state, { type: 'activate', id: 'session-8' });
    const before = state.sessions.find(({ id }) => id === 'session-2');
    expect(projectTabs(state).overflow.map(({ id }) => id)).toContain(
      'session-2',
    );

    state = tabReducer(state, { type: 'close', id: 'session-2' });
    expect(state.activeId).toBe('session-8');
    expect(state.pendingTransition?.target_session_id).toBe('session-2');
    expect(state.sessions.find(({ id }) => id === 'session-2')).toMatchObject({
      dirty: true,
      lifecycle: before?.lifecycle,
    });

    state = tabReducer(state, {
      type: 'resolve_transition',
      decision: 'cancel',
    });
    expect(state.pendingTransition).toBeNull();
    expect(state.sessions.find(({ id }) => id === 'session-2')?.dirty).toBe(
      true,
    );
  });

  it('retains the session while save intent awaits a real durable receipt', () => {
    const writable = sessions(2).map((item) =>
      item.id === 'session-2'
        ? {
            ...item,
            source: {
              ...item.source,
              capabilities: {
                ...item.source.capabilities,
                write: true,
                revalidate: true,
              },
            },
          }
        : item,
    );
    let state = createTabState(writable);
    state = tabReducer(state, { type: 'close', id: 'session-2' });
    state = tabReducer(state, {
      type: 'resolve_transition',
      decision: 'save',
    });
    expect(state.sessions.map(({ id }) => id)).toContain('session-2');
    expect(state.pendingTransition).toMatchObject({
      status: 'saving',
      save_intent: 'save',
    });
    expect(state.announcement).toMatch(/durable save receipt/i);
  });

  it('does not erase conflict integrity when activating a session', () => {
    const conflicted = sessions(2).map((item) =>
      item.id === 'session-2'
        ? { ...item, integrity: 'conflicted' as const }
        : item,
    );
    const state = tabReducer(createTabState(conflicted), {
      type: 'activate',
      id: 'session-2',
    });
    expect(state.sessions.find(({ id }) => id === 'session-2')).toMatchObject({
      lifecycle: 'active',
      focus: 'active',
      integrity: 'conflicted',
      revision: 1,
    });
  });

  it('rejects a destructive decision when edits changed after the prompt opened', () => {
    let state = createTabState(sessions(2));
    state = tabReducer(state, { type: 'close', id: 'session-2' });
    state = {
      ...state,
      sessions: state.sessions.map((item) =>
        item.id === 'session-2'
          ? { ...item, revision: item.revision + 1, content: 'newer edits' }
          : item,
      ),
    };
    state = tabReducer(state, {
      type: 'resolve_transition',
      decision: 'discard',
    });
    expect(state.sessions.find(({ id }) => id === 'session-2')).toMatchObject({
      revision: 2,
      content: 'newer edits',
      dirty: true,
    });
    expect(state.pendingTransition?.requested_session_revision).toBe(2);
    expect(state.announcement).toMatch(/changed while the decision was open/i);
  });

  it('reload resolution keeps the session and clears only explicitly discarded edits', () => {
    let state = createTabState(sessions(2));
    state = tabReducer(state, {
      type: 'request_transition',
      id: 'session-2',
      kind: 'reload',
    });
    state = tabReducer(state, {
      type: 'resolve_transition',
      decision: 'discard',
    });

    expect(state.sessions).toHaveLength(2);
    expect(state.sessions.find(({ id }) => id === 'session-2')).toMatchObject({
      dirty: false,
      integrity: 'clean',
      content: 'Document 2',
    });
    expect(state.pendingTransition).toBeNull();
    expect(state.announcement).toMatch(/reload authorized/i);
  });

  it('keeps dirty background models and every overflowed session reachable', () => {
    let state = createTabState(sessions(100));
    state = tabReducer(state, { type: 'activate', id: 'session-100' });
    const projection = projectTabs(state, 5);
    expect(projection.inline.map(({ id }) => id)).toContain('session-100');
    expect([...projection.inline, ...projection.overflow]).toHaveLength(100);
    expect(
      new Set(
        [...projection.inline, ...projection.overflow].map(({ id }) => id),
      ).size,
    ).toBe(100);
    expect(state.sessions.find(({ id }) => id === 'session-2')?.dirty).toBe(
      true,
    );
  });

  it('produces a minimal empty state after the final close', () => {
    const initial = createTabState(sessions(1));
    const state = tabReducer(initial, { type: 'close', id: 'session-1' });
    expect(state.sessions).toEqual([]);
    expect(state.activeId).toBeNull();
  });

  it('persists Markdown mode only for the exact session revision', () => {
    const initial = createTabState(sessions(1));
    const markdown = {
      mode: 'source' as const,
      eligibility: 'full' as const,
      render_revision: 1,
      render_status: 'ready' as const,
      source_selection: { from: 0, to: 4 },
    };
    const updated = tabReducer(initial, {
      type: 'update_markdown',
      id: 'session-1',
      expectedRevision: 1,
      markdown,
    });
    expect(updated.sessions[0]?.markdown_document).toEqual(markdown);
    const stale = tabReducer(updated, {
      type: 'update_markdown',
      id: 'session-1',
      expectedRevision: 0,
      markdown: { ...markdown, mode: 'rendered' },
    });
    expect(stale.sessions[0]?.markdown_document?.mode).toBe('source');
  });
});
