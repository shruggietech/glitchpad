import { describe, expect, it } from 'vitest';

import type { ShellSession } from './contracts';
import {
  canSaveInPlace,
  integrityOf,
  projectRecoveredSession,
  projectRecoveryInventory,
  requestTransition,
} from './recovery';

const session = (overrides: Partial<ShellSession> = {}): ShellSession => ({
  id: 'draft',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'tests',
      token: 'draft',
      strength: 'strong',
    },
    display_name: 'draft.txt',
    claimed_media_type: 'text/plain',
    byte_length: 5,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: {
      read: true,
      seek: false,
      stream: false,
      metadata: false,
      observe_revision: true,
      revalidate: true,
      watch: false,
      write: true,
      replace_atomically: true,
      persistent_permission: false,
      rename: false,
      observe_deletion: true,
      reopen: false,
      reveal_location: false,
    },
  },
  renderer: {
    id: 'text',
    label: 'Text',
    capabilities: {
      view: true,
      edit: true,
      navigate: false,
      search: true,
      zoom: false,
      copy: true,
      save: true,
      inspect_metadata: false,
    },
  },
  lifecycle: 'active',
  focus: 'active',
  integrity: 'dirty',
  source_state: 'available',
  dirty: true,
  revision: 3,
  content: 'draft',
  ...overrides,
});

describe('recovery projection', () => {
  it('keeps integrity independent from legacy focus changes', () => {
    expect(integrityOf(session({ lifecycle: 'background' }))).toBe('dirty');
    expect(integrityOf(session({ integrity: 'conflicted', dirty: true }))).toBe(
      'conflicted',
    );
  });

  it('permits ordinary save only with current revalidatable authority', () => {
    expect(canSaveInPlace(session())).toBe(true);
    expect(canSaveInPlace(session({ integrity: 'conflicted' }))).toBe(false);
    expect(canSaveInPlace(session({ source_state: 'deleted' }))).toBe(false);
  });

  it('binds a destructive transition to the exact dirty revision', () => {
    expect(requestTransition(session(), 'close')).toEqual({
      kind: 'close',
      target_session_id: 'draft',
      requested_session_revision: 3,
      status: 'awaiting_decision',
      save_intent: null,
    });
  });

  it('projects accepted recovery as dirty recovery-only content without source authority', () => {
    const recovered = projectRecoveredSession({
      inventory: {
        record_id: '8df38876-5934-4d82-b14a-857c0c0a2387',
        display_hint: 'recovered.txt',
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        committed_bytes: 100,
        status: 'available',
      },
      content: 'local edits',
      snapshot_session_revision: 7,
      text_profile: {
        encoding: 'utf8',
        bom: 'absent',
        newlines: 'lf',
        terminal_newline: 'absent',
        undecodable_bytes: 'none',
      },
    });
    expect(recovered).toMatchObject({
      dirty: true,
      integrity: 'recovery_only',
      source_state: 'unavailable',
      content: 'local edits',
    });
    expect(recovered.source.capabilities.write).toBe(false);
    expect(recovered.text_document?.normalized_text).toBe('local edits');
  });

  it('restores a lossless text document from raw recovery content and profile', () => {
    const recovered = projectRecoveredSession({
      inventory: {
        record_id: '33fa36e2-4d36-4e76-887e-d861b5b53073',
        display_hint: 'recovered.ts',
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        committed_bytes: 100,
        status: 'available',
      },
      content: 'first\r\nsecond\n',
      snapshot_session_revision: 9,
      text_profile: {
        encoding: 'utf16_le_bom',
        bom: 'present',
        newlines: 'mixed',
        terminal_newline: 'present',
        undecodable_bytes: 'none',
      },
    });
    expect(recovered.content).toBe('first\nsecond\n');
    expect(recovered.text_document).toMatchObject({
      raw_text: 'first\r\nsecond\n',
      normalized_text: 'first\nsecond\n',
      profile: {
        encoding: 'utf16_le_bom',
        bom: 'present',
        newline_pattern: 'mixed',
      },
      language: { language: 'typescript' },
    });
  });

  it('recovers Mermaid source losslessly without inventing source authority', () => {
    const recovered = projectRecoveredSession({
      inventory: {
        record_id: '3dc180ca-c88a-4693-8b1b-e17428a23e0e',
        display_hint: 'architecture.mmd',
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        committed_bytes: 40,
        status: 'available',
      },
      content: 'flowchart TB\r\n  Alpha --> Beta\r\n',
      snapshot_session_revision: 11,
      text_profile: {
        encoding: 'utf8',
        bom: 'absent',
        newlines: 'crlf',
        terminal_newline: 'present',
        undecodable_bytes: 'none',
      },
    });
    expect(recovered).toMatchObject({ integrity: 'recovery_only', source_state: 'unavailable' });
    expect(recovered.text_document).toMatchObject({
      raw_text: 'flowchart TB\r\n  Alpha --> Beta\r\n',
      normalized_text: 'flowchart TB\n  Alpha --> Beta\n',
      language: { language: 'plain_text' },
    });
    expect(recovered.source.capabilities.write).toBe(false);
  });

  it('presents only recoverable inventory while keeping safe aggregate notices', () => {
    const entry = (
      status: 'available' | 'corrupted' | 'unsupported',
      updated: number,
    ) => ({
      record_id: `${status}-${updated}`,
      display_hint: 'draft.txt',
      updated_unix_ms: updated,
      expires_unix_ms: 100,
      committed_bytes: 10,
      status,
    });
    const projection = projectRecoveryInventory([
      entry('available', 1),
      entry('corrupted', 2),
      entry('available', 3),
      entry('unsupported', 4),
    ]);
    expect(
      projection.available.map(({ updated_unix_ms }) => updated_unix_ms),
    ).toEqual([3, 1]);
    expect(projection.notices).toEqual([
      '1 corrupted recovery record isolated.',
      '1 newer recovery record preserved but not opened.',
    ]);
  });
});
