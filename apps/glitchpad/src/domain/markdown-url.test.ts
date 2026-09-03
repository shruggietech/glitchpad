import { describe, expect, it } from 'vitest';

import { classifyMarkdownResource, classifyMarkdownTarget } from './markdown-url';

describe('Markdown destination policy', () => {
  it.each([
    ['javascript:alert(1)', 'target_scheme'],
    ['data:text/html,owned', 'target_scheme'],
    ['https://user:secret@example.com', 'target_credentials'],
    ['//example.com/path', 'target_ambiguous'],
    ['https:%2f%2fevil.example/%0a', 'target_control'],
    ['https://example.com/\u202eevil', 'target_control'],
  ])('blocks unsafe target %s', (target, reason) => {
    expect(classifyMarkdownTarget(target)).toMatchObject({
      normalized_target: null,
      reason_code: reason,
    });
  });

  it('normalizes disclosed external and email destinations', () => {
    expect(classifyMarkdownTarget('HTTPS://Example.COM/a')).toMatchObject({
      kind: 'external',
      normalized_target: 'https://example.com/a',
    });
    expect(classifyMarkdownTarget('mailto:reader@example.com')).toMatchObject({
      kind: 'email',
    });
  });

  it('keeps fragments and local paths inside separate authority classes', () => {
    expect(classifyMarkdownTarget('#section')).toMatchObject({ kind: 'fragment' });
    expect(classifyMarkdownTarget('./image.png')).toMatchObject({ kind: 'local' });
  });

  it('blocks all remote image resources before resolution', () => {
    expect(classifyMarkdownResource('https://tracker.example/pixel', 'pixel')).toMatchObject({
      kind: 'blocked',
      normalized_target: null,
      reason_code: 'remote_resource_blocked',
    });
  });
});
