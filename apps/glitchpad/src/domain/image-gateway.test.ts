import { describe, expect, it, vi } from 'vitest';
import { createImageGateway, identifyImageSource } from './image-gateway';
import { createImageSession } from './image-contract';
import { makeSession } from '../test/fixtures';

const session = () => {
  const source = makeSession('a', 'image.png', 'Text', '', {}).source;
  return createImageSession(source, 'opaque', { identity: source.identity, byte_length: 12, modified_unix_nanos: null, change_token: null }, 'png', 'desktop');
};

describe('native image gateway', () => {
  it('uses only registered source authority for content identification', async () => {
    const call = vi.fn(() => Promise.resolve('png'));
    const image = session();
    expect(await identifyImageSource(call, image.source_id!, image.external_revision!)).toBe('png');
    expect(call.mock.calls[0]).toEqual(['identify_image_source', { sourceId: 'opaque', expectedRevision: image.external_revision }]);
  });
  it('cancels the exact pending owner request and discards late output', async () => {
    let resolve!: (value: unknown) => void;
    const call = vi.fn((command: string) => command === 'render_image_source' ? new Promise(r => { resolve = r; }) : Promise.resolve(true));
    const abort = new AbortController();
    const pending = createImageGateway(call).render(session(), abort.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort();
    resolve({});
    await rejected;
    expect(call.mock.calls.map(c => c[0])).toEqual(['render_image_source', 'cancel_image_render']);
  });
  it('rejects malformed or unrelated native results', async () => {
    await expect(createImageGateway(() => Promise.resolve({})).render(session(), new AbortController().signal)).rejects.toThrow('invalid bounded result');
  });
});
