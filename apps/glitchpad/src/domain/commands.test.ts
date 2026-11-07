import { describe, expect, it } from 'vitest';

import type { ShellSession } from './contracts';
import { commandSetFor, executeCommand } from './commands';
import { createDraftSession } from './drafts';
import { createTextDocument } from './text-document';

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
      'fit',
      'save',
      'metadata',
    ]);
  });

  it.each(['draft', 'copy'] as const)(
    'exposes Save As for an editable %s without source write authority',
    (origin) => {
      const original = session();
      original.source_id = 'read-only-native-source';
      original.source.capabilities.write = false;
      original.renderer.capabilities.edit = false;
      original.renderer.capabilities.save = false;
      original.text_document = createTextDocument({
        rawText: original.content,
        displayName: original.source.display_name,
      });
      expect(commandSetFor(original).map(({ id }) => id)).toContain(
        'edit_copy',
      );
      const draft = createDraftSession(
        'markdown',
        origin === 'copy' ? original : undefined,
      );
      const saveAs = commandSetFor(draft).find(({ id }) => id === 'save_as');
      expect(draft.source_id).toBeNull();
      expect(draft.source.capabilities.write).toBe(false);
      expect(saveAs).toMatchObject({ label: 'Save As…', enabled: true });
      expect(executeCommand(saveAs!, draft)).toEqual({
        ok: true,
        message: 'Save As… is available',
      });
    },
  );

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

  it('labels the Mermaid mode command from its source projection', () => {
    const mermaid = session({
      renderer: { ...session().renderer, id: 'mermaid', label: 'Mermaid' },
      markdown_document: null,
      mermaid_document: {
        mode: 'source',
        render_revision: 4,
        render_status: 'ready',
        preview_stale: false,
        viewport: { mode: 'fit', zoom: 1, pan_x: 0, pan_y: 0 },
      },
    });
    expect(commandSetFor(mermaid).find(({ id }) => id === 'edit')?.label).toBe(
      'Read',
    );
  });
});

describe('current editor availability and provider scope', () => {
  it('uses actual history and wrapping state while leaving unsupported page controls absent', () => {
    const current = session();
    current.renderer.capabilities.navigate = true;
    const commands = commandSetFor(current, {
      undo: false,
      redo: true,
      wrapped: true,
    });
    expect(commands.find(({ id }) => id === 'undo')?.enabled).toBe(false);
    expect(commands.find(({ id }) => id === 'redo')?.enabled).toBe(true);
    expect(
      commands.some(({ id }) => id === 'previous_page' || id === 'next_page'),
    ).toBe(false);
  });
});

describe('document task command contexts', () => {
  it('offers Details for actual text sources and Large text tools only for windowed sources', () => {
    const text = createDraftSession('text');
    text.text_document = { ...text.text_document!, mode: 'editable' };
    const textIds = commandSetFor(text).map(({ id }) => id);
    expect(textIds).toContain('document_details');
    expect(textIds).not.toContain('large_text_tools');
    expect(
      commandSetFor({
        ...text,
        source: {
          ...text.source,
          capabilities: { ...text.source.capabilities, write: false },
        },
        renderer: {
          ...text.renderer,
          capabilities: { ...text.renderer.capabilities, edit: false },
        },
      }).map(({ id }) => id),
    ).toContain('document_details');

    const windowed = {
      ...text,
      source_id: 'test-source',
      text_document: {
        ...text.text_document,
        mode: 'large_read_only' as const,
      },
    };
    const windowIds = commandSetFor(windowed).map(({ id }) => id);
    expect(windowIds).toContain('large_text_tools');
    expect(windowIds).not.toContain('document_details');
    expect(
      commandSetFor({ ...windowed, source_id: undefined }).map(({ id }) => id),
    ).not.toContain('large_text_tools');
    const markdown = createDraftSession('markdown');
    const rendered = {
      ...markdown,
      markdown_document: {
        ...markdown.markdown_document!,
        mode: 'rendered' as const,
      },
    };
    expect(commandSetFor(rendered).map(({ id }) => id)).not.toContain(
      'document_details',
    );
    expect(
      commandSetFor({
        ...rendered,
        markdown_document: { ...rendered.markdown_document, mode: 'source' },
      }).map(({ id }) => id),
    ).toContain('document_details');
    expect(
      commandSetFor({ ...text, text_document: undefined }).map(({ id }) => id),
    ).not.toContain('document_details');
  });
});
