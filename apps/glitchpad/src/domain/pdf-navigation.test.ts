import { describe, it, expect } from 'vitest';
import {
  boundedOutline,
  destinationShape,
  destinationPoint,
  pageMatches,
} from './pdf-navigation';
describe('PDF navigation bounds', () => {
  it('keeps document order and bounds cycles, depth and node count', () => {
    const child = { title: 'Child', dest: 'child', items: [] as unknown[] };
    const first = { title: 'First', dest: 'first', items: [child] };
    child.items.push(first);
    const result = boundedOutline([first, { title: 'Last', dest: 'last' }]);
    expect(result.rows.map((row) => row.title)).toEqual([
      'First',
      'Child',
      'Last',
    ]);
    expect(result.limited).toBe(true);
    expect(
      boundedOutline(Array.from({ length: 5000 }, () => ({ title: 'Page' })))
        .rows,
    ).toHaveLength(4096);
  });
  it('refuses malformed destinations without guessing coordinates', () => {
    for (const input of [
      null,
      [],
      [0, { name: 'XYZ' }, NaN, 0, null],
      [0, { name: 'Launch' }],
      [0, { name: 'Fit' }, 'extra'],
    ])
      expect(() => destinationShape(input)).toThrow('invalid_destination');
    expect(destinationPoint('XYZ', [12, 45, null], 2)).toEqual({
      page: 2,
      x: 12,
      y: 45,
    });
    expect(destinationShape([0, { name: 'Fit' }]).mode).toBe('Fit');
  });
  it('returns bounded ordered search results with context', () => {
    expect(pageMatches('One match. Another MATCH.', 'match', 4, 1)).toEqual([
      {
        page: 4,
        offset: 4,
        text: 'match',
        context: 'One match. Another MATCH.',
      },
    ]);
    expect(pageMatches('aaa', '', 0, 10)).toEqual([]);
  });
});
