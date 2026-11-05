import { describe, it, expect, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
import { recordFailure, collectFailureEvents } from './diagnostic-failures';

describe('bounded diagnostic failure capture', () => {
  it('records only allowlisted stage/reason context with random content-free correlation', async () => {
    recordFailure('markdown', 'projection', 'markdown_projection_failed');
    recordFailure('markdown', '/private/name.md', 'markdown_projection_failed');
    recordFailure('source', 'delivery', 'content://private/path');
    const events = await collectFailureEvents();
    expect(events).toHaveLength(1);
    expect(events[0].failure).toMatchObject({
      component: 'markdown',
      stage: 'projection',
      reason: 'markdown_projection_failed',
    });
    expect(events[0].failure?.correlation_id).toMatch(/^[a-f0-9]{32}$/u);
    expect(JSON.stringify(events)).not.toMatch(/content:|private|name\.md/u);
  });
});
