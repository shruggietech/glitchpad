import { describe, expect, it } from 'vitest';

import { markdownEligibility } from './markdown-contract';
import { commandSetFor } from './commands';
import { initialSessions } from '../test/fixtures';

describe('Markdown renderer conformance', () => {
  it.each([
    [16 * 1024 * 1024, 'full'],
    [16 * 1024 * 1024 + 1, 'source_only'],
    [32 * 1024 * 1024, 'source_only'],
    [32 * 1024 * 1024 + 1, 'large_read_only'],
    [256 * 1024 * 1024, 'large_read_only'],
    [256 * 1024 * 1024 + 1, 'refused'],
  ])('maps %i bytes to %s', (bytes, expected) => {
    expect(markdownEligibility(bytes)).toBe(expected);
  });

  it('retains shared viewer commands and gates editing by source authority', () => {
    const renderedWithOutline = {
      ...initialSessions[0],
      markdown_document: {
        ...initialSessions[0].markdown_document!,
        render_revision: initialSessions[0].revision,
        render_status: 'ready' as const,
        printable: true,
        outline_count: 1,
      },
    };
    const readOnly = commandSetFor(renderedWithOutline).map(({ id }) => id);
    const writable = commandSetFor(initialSessions[3]).map(({ id }) => id);
    expect(readOnly).toEqual(expect.arrayContaining(['copy', 'search', 'find_next', 'find_previous']));
    expect(readOnly).toContain('edit');
    expect(readOnly).toContain('outline');
    expect(readOnly).toContain('print');
    expect(writable).toEqual(expect.arrayContaining(['edit', 'undo', 'redo', 'save']));

    const sourceMode = {
      ...initialSessions[3],
      markdown_document: {
        ...initialSessions[3].markdown_document!,
        mode: 'source' as const,
      },
    };
    expect(commandSetFor(sourceMode).map(({ id }) => id)).not.toContain('outline');

    const renderedWithoutOutline = {
      ...renderedWithOutline,
      markdown_document: { ...renderedWithOutline.markdown_document, outline_count: 0 },
    };
    expect(commandSetFor(renderedWithoutOutline).map(({ id }) => id)).not.toContain('outline');
    expect(commandSetFor(renderedWithoutOutline).map(({ id }) => id)).toContain('print');

    const unavailableTree = {
      ...renderedWithOutline,
      markdown_document: { ...renderedWithOutline.markdown_document, printable: false, outline_count: 0 },
    };
    expect(commandSetFor(unavailableTree).map(({ id }) => id)).not.toContain('print');
  });
});
