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
        revalidate: false,
        write: false,
        replace_atomically: false,
        reopen: false,
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
    expect(state.activeId).toBe('session-4');
    expect(state.sessions.find(({ id }) => id === 'session-4')?.lifecycle).toBe(
      'active',
    );
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
});
