import { describe, expect, it, vi } from 'vitest';
import { createImageGateway, identifyImageSource } from './image-gateway';
import { createImageSession } from './image-contract';
import { makeSession } from '../test/fixtures';

const session = () => {
  const source = makeSession('a', 'image.png', 'Text', '', {}).source;
  return createImageSession(source, 'opaque', { identity: source.identity, byte_length: 12, modified_unix_nanos: null, change_token: null }, 'png', 'desktop');
};

describe('native image gateway', () => {
  it('exports a selected source-bound entry without browser bytes or destination authority', async () => {
    const image = session();
    image.image_document!.family_state = { family: 'ico', selected_entry: 0, selected_entry_export: true, entries: [{ index: 0, width: 1, height: 1, bits_per_pixel: 32, encoded_bytes: 64, encoding: 'png', alpha: true, failure: null, duplicate_of: null, preview: 'full' }] };
    const call = vi.fn(() => Promise.resolve({ status: 'exported', durability: 'atomic_file' }));
    expect(await createImageGateway(call).exportEntry!(image, new AbortController().signal)).toEqual({ status: 'exported', durability: 'atomic_file' });
    const [command,args] = call.mock.calls[0] as unknown as [string,Record<string,unknown>];
    expect(command).toBe('export_image_entry');
    expect(Object.keys(args).sort()).toEqual(['entry','expectedRevision','requestId','sourceId']);
    expect(args.entry).toBe(0);
    expect(args.sourceId).toBe('opaque');
  });
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
