import { describe, expect, it } from 'vitest';

import { markdownEligibility } from './markdown-contract';
import { commandSetFor } from './commands';
import { initialSessions } from '../App';

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
    const readOnly = commandSetFor(initialSessions[0]).map(({ id }) => id);
    const writable = commandSetFor(initialSessions[3]).map(({ id }) => id);
    expect(readOnly).toEqual(expect.arrayContaining(['copy', 'search', 'find_next', 'find_previous']));
    expect(readOnly).not.toContain('edit');
    expect(writable).toEqual(expect.arrayContaining(['edit', 'undo', 'redo', 'save']));
  });
});
