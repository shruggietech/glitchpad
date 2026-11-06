import { makeSession } from '../test/fixtures';
import { describe, expect, it } from 'vitest';
import { createDraftSession } from './drafts';
import { commandSetFor, performCommand } from './commands';
import { createTabState, tabReducer } from './tabs';

describe('source-independent authoring', () => {
  it('creates distinct editable Markdown/text drafts without external authority', () => {
    const md = createDraftSession('markdown');
    const text = createDraftSession('text');
    expect(md.id).not.toBe(text.id);
    expect(md.source_id).toBeNull();
    expect(md.external_revision).toBeNull();
    expect(md.source.capabilities.write).toBe(false);
    expect(md.dirty).toBe(true);
    expect(md.markdown_document?.mode).toBe('source');
    expect(text.renderer.id).toBe('text');
    expect(commandSetFor(md).some((c) => c.id === 'save')).toBe(true);
  });
  it('never reports a missing or denied handler as performed', async () => {
    const current = createDraftSession('text');
    current.lifecycle = 'active';
    const copy = commandSetFor(current).find((c) => c.id === 'copy')!;
    expect(
      await performCommand(
        copy,
        () => current,
        () => false,
      ),
    ).toMatchObject({ status: 'unavailable' });
    expect(
      await performCommand(
        copy,
        () => current,
        () => Promise.reject(new Error('private URI')),
      ),
    ).toEqual({ status: 'failed', reason: 'operation_failed' });
    expect(
      await performCommand(
        copy,
        () => ({ ...current, revision: current.revision + 1 }),
        () => true,
      ),
    ).toMatchObject({ status: 'cancelled' });
  });
  it('blocks destructive resolution during a write and preserves edits newer than its receipt', () => {
    const draft = createDraftSession('markdown');
    let state = createTabState([draft]);
    state = tabReducer(state, {
      type: 'destination_save_started',
      id: draft.id,
      revision: draft.revision,
    });
    state = tabReducer(state, { type: 'close', id: draft.id });
    expect(state.pendingTransition).toBeNull();
    const source = {
      source_id: 'native-destination',
      descriptor: { ...draft.source, kind: 'document_uri' as const },
      external_revision: {
        identity: draft.source.identity,
        byte_length: 4,
        modified_unix_nanos: null,
        change_token: null,
      },
      delivery_kind: 'create_result' as const,
      grant: {
        read: true,
        write: true,
        persisted_read: true,
        persisted_write: true,
        restorable: true,
      },
    };
    state = {
      ...state,
      sessions: state.sessions.map((s) => ({
        ...s,
        revision: s.revision + 1,
        content: 'new edits',
      })),
    };
    state = tabReducer(state, {
      type: 'destination_saved',
      id: draft.id,
      receipt: { source, byte_count: 4, saved_revision: draft.revision },
    });
    expect(state.sessions[0].dirty).toBe(true);
    expect(state.sessions[0].source_id).toBe('native-destination');
    expect(state.sessions[0].content).toBe('new edits');
  });
});

describe('Mermaid copy authoring', () => {
  it('retains the Mermaid renderer, source mode and viewport without original write authority', () => {
    const original = makeSession(
      'diagram-copy-origin',
      'diagram.mmd',
      'Mermaid',
      'flowchart TB\n  Alpha --> Beta\n',
      { search: true, zoom: true, navigate: true, inspect_metadata: true },
    );
    original.source_id = 'original-mermaid';
    original.external_revision = {
      identity: original.source.identity,
      byte_length: original.text_document!.source_bytes,
      modified_unix_nanos: '1',
      change_token: null,
    };
    original.mermaid_document!.viewport = {
      mode: 'custom',
      zoom: 1.5,
      pan_x: 3,
      pan_y: -2,
    };
    const before = JSON.stringify(original);
    const copy = createDraftSession('text', original);
    expect(copy.renderer.id).toBe('mermaid');
    const alternateDefault = createDraftSession('markdown', original);
    expect(alternateDefault.renderer.id).toBe('mermaid');
    expect(alternateDefault.markdown_document).toBeNull();
    expect(copy.renderer.capabilities).toMatchObject({
      edit: true,
      save: true,
      search: true,
      zoom: true,
      navigate: true,
      inspect_metadata: true,
    });
    expect(copy.mermaid_document).toMatchObject({
      mode: 'source',
      render_revision: null,
      render_status: 'idle',
      preview_stale: false,
      viewport: original.mermaid_document!.viewport,
    });
    expect(copy.mermaid_document!.viewport).not.toBe(
      original.mermaid_document!.viewport,
    );
    expect(copy.content).toBe(original.content);
    expect(copy.text_document!.normalized_text).toBe(
      original.text_document!.normalized_text,
    );
    expect(copy.source.claimed_media_type).toBe('text/vnd.mermaid');
    expect(copy.source_id).toBeNull();
    expect(copy.external_revision).toBeNull();
    expect(copy.source.capabilities.write).toBe(false);
    expect(copy.copy_source).toEqual({
      source_id: original.source_id,
      external_revision: original.external_revision,
    });
    expect(copy.edit_origin).toBe('copy');
    expect(copy.dirty).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
  });
});
