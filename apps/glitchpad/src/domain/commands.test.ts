import { describe, expect, it } from 'vitest';

import type { ShellSession } from './contracts';
import { commandSetFor, executeCommand } from './commands';

const session = (overrides: Partial<ShellSession> = {}): ShellSession => ({
  id: 'one',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'tests',
      token: 'one',
      strength: 'strong',
    },
    display_name: 'one.md',
    claimed_media_type: 'text/markdown',
    byte_length: 12,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: {
      read: true,
      seek: false,
      stream: false,
      metadata: true,
      observe_revision: false,
      watch: false,
      revalidate: false,
      write: true,
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
      edit: true,
      navigate: false,
      search: true,
      zoom: true,
      copy: true,
      save: true,
      inspect_metadata: true,
    },
  },
  lifecycle: 'active',
  dirty: true,
  revision: 4,
  content: 'Content',
  ...overrides,
});

describe('renderer-driven commands', () => {
  it('returns all and only commands supported by the active source and renderer', () => {
    expect(commandSetFor(session()).map(({ id }) => id)).toEqual([
      'copy',
      'search',
      'find_next',
      'find_previous',
      'go_to_line',
      'undo',
      'redo',
      'indent',
      'outdent',
      'zoom_out',
      'zoom_in',
      'edit',
      'save',
      'metadata',
    ]);
  });

  it('rejects stale targets and survives 100 rapid active-session changes', () => {
    let current = session();
    const command = commandSetFor(current)[0];
    expect(command).toBeDefined();
    for (let revision = 5; revision < 105; revision += 1) {
      current = session({ revision });
      expect(executeCommand(command, current)).toEqual({
        ok: false,
        reason: 'stale_session',
      });
    }
  });
});
