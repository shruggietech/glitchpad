import { describe, expect, it } from 'vitest';
import { makeSession } from '../test/fixtures';
import { createImageSession } from './image-contract';
import { bulkCopyText, projectSessionMetadata } from './metadata';
import { createTabState, tabReducer } from './tabs';
import type { SourceMetadataSnapshot } from './contracts';

const source = makeSession('image', 'photo.png', 'Text', '', {}).source;
const revision = { identity: source.identity, byte_length: 24, modified_unix_nanos: null, change_token: null };
const image = () => {
  const session = createImageSession(source, 'opaque', revision, 'png', 'desktop');
  session.image_document!.metadata = { observations: [
    { key: 'image.camera_make', family: 'exif', tag: 'Make', block: 1, availability: 'available', value: { kind: 'text', value: 'Example' }, original: { kind: 'text', value: 'Example' }, duplicate: false },
    { key: 'image.location', family: 'exif', tag: 'GPS', block: 1, availability: 'redacted', value: null, original: null, duplicate: false },
  ], statuses: ['metadata_partial'], unknown_fields: 1, profile_present: false };
  return session;
};

describe('image inspector projection and revision refresh', () => {
  it('keeps known embedded facts typed and redacted fields out of bulk copy', () => {
    const snapshot = projectSessionMetadata(image());
    expect(snapshot.facts.find(f => f.key === 'image.camera_make')?.value).toEqual({ kind: 'text', value: 'Example' });
    expect(snapshot.facts.find(f => f.key === 'image.location')).toMatchObject({ availability: 'redacted', value: undefined });
    const copied = bulkCopyText(snapshot);
    expect(copied).toContain('Example');
    expect(copied).not.toContain('Location');
    expect(snapshot.facts.some(f => f.key.startsWith('text.'))).toBe(false);
  });
  it('atomically invalidates image facts, rejects old completions, and retains the same tab', () => {
    const session = image();
    const state = createTabState([session]);
    const updated: SourceMetadataSnapshot = { source_id: 'opaque', external_revision: { ...revision, byte_length: 32, change_token: 'new' }, display_name: 'photo.png', source_kind: source.kind, byte_length: 32, modified_unix_nanos: null, created_unix_nanos: null, accessed_unix_nanos: null, write_state: 'read_only', identity_confidence: 'strong' };
    const next = tabReducer(state, { type: 'refresh_metadata', id: session.id, expectedRevision: 1, expectedExternalRevision: revision, source: updated });
    expect(next.sessions[0]).toMatchObject({ id: session.id, revision: 2, external_revision: updated.external_revision, dirty: false, image_document: { descriptor: null, metadata: null, status: 'idle' } });
    expect(projectSessionMetadata(next.sessions[0]).facts.find(f => f.key === 'image.camera_make')?.availability).toBe('not_provided');
    expect(tabReducer(next, { type: 'update_image', id: session.id, expectedRevision: 1, image: session.image_document! })).toBe(next);
  });
  it('clears preview and embedded facts on revocation without repeatedly changing revision', () => {
    const session = image();
    const initial = createTabState([session]);
    const next = tabReducer(initial, { type: 'metadata_unavailable', id: session.id, expectedRevision: 1, sourceId: 'opaque' });
    expect(next.sessions[0]).toMatchObject({ revision: 2, source_state: 'unavailable', image_document: { descriptor: null, metadata: null, status: 'failed' } });
    expect(tabReducer(next, { type: 'metadata_unavailable', id: session.id, expectedRevision: 2, sourceId: 'opaque' })).toBe(next);
  });
});
