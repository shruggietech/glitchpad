import { describe, expect, it } from 'vitest';

import { commandSetFor } from './commands';
import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from './contracts';
import { createTextDocument, serializeTextDocument } from './text-document';

const session = (sourceBytes: number): ShellSession => ({
  id: 'text',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'conformance',
      token: 'text',
      strength: 'strong',
    },
    display_name: 'text.txt',
    claimed_media_type: 'text/plain',
    byte_length: sourceBytes,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: {
      ...noSourceCapabilities(),
      read: true,
      seek: true,
      write: sourceBytes <= 32 * 1024 * 1024,
    },
  },
  renderer: {
    id: 'text',
    label: 'Text',
    capabilities: {
      ...noRendererCapabilities(),
      view: true,
      copy: true,
      search: true,
      edit: sourceBytes <= 32 * 1024 * 1024,
      save: sourceBytes <= 32 * 1024 * 1024,
    },
  },
  lifecycle: 'active',
  dirty: false,
  revision: 1,
  content: sourceBytes <= 32 * 1024 * 1024 ? 'content' : '',
  source_id: 'source',
  text_document: createTextDocument({
    rawText: sourceBytes <= 32 * 1024 * 1024 ? 'content' : '',
    displayName: 'text.txt',
    sourceBytes,
  }),
});

describe('text renderer conformance', () => {
  it('denies mutation and save commands in large and refused modes', () => {
    for (const sourceBytes of [32 * 1024 * 1024 + 1, 256 * 1024 * 1024 + 1]) {
      const ids = commandSetFor(session(sourceBytes)).map(({ id }) => id);
      expect(ids).not.toContain('edit');
      expect(ids).not.toContain('save');
      expect(ids).not.toContain('undo');
      expect(ids).not.toContain('redo');
    }
  });

  it('denies stale and lossy serialization before producing bytes', () => {
    const document = createTextDocument({
      rawText: 'unsafe \uFFFD',
      displayName: 'legacy.txt',
      encoding: 'unknown',
      undecodableBytes: 'requires_user_decision',
    });
    expect(serializeTextDocument(document, 2, 1)).toEqual({
      ok: false,
      reason: 'stale_revision',
    });
    expect(serializeTextDocument(document, 2, 2)).toEqual({
      ok: false,
      reason: 'lossy_decision_required',
    });
  });
});
