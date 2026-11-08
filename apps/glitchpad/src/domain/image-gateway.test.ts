import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImageGateway, identifyImageSource } from './image-gateway';
import { createImageSession } from './image-contract';
import { installRecoveryProbeListener } from './recovery-probes';
import { makeSession } from '../test/fixtures';

const session = () => {
  const source = makeSession('a', 'image.png', 'Text', '', {}).source;
  return createImageSession(
    source,
    'opaque',
    {
      identity: source.identity,
      byte_length: 12,
      modified_unix_nanos: null,
      change_token: null,
    },
    'png',
    'desktop',
  );
};

describe('native image gateway', () => {
  it('exports a selected source-bound entry without browser bytes or destination authority', async () => {
    const image = session();
    image.image_document!.family_state = {
      family: 'ico',
      selected_entry: 0,
      selected_entry_export: true,
      entries: [
        {
          index: 0,
          width: 1,
          height: 1,
          bits_per_pixel: 32,
          encoded_bytes: 64,
          encoding: 'png',
          alpha: true,
          failure: null,
          duplicate_of: null,
          preview: 'full',
        },
      ],
    };
    const call = vi.fn(() =>
      Promise.resolve({ status: 'exported', durability: 'atomic_file' }),
    );
    expect(
      await createImageGateway(call).exportEntry!(
        image,
        new AbortController().signal,
      ),
    ).toEqual({ status: 'exported', durability: 'atomic_file' });
    const [command, args] = call.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(command).toBe('export_image_entry');
    expect(Object.keys(args).sort()).toEqual([
      'entry',
      'expectedRevision',
      'requestId',
      'sourceId',
    ]);
    expect(args.entry).toBe(0);
    expect(args.sourceId).toBe('opaque');
  });
  it('uses only registered source authority for content identification', async () => {
    const call = vi.fn(() => Promise.resolve('png'));
    const image = session();
    expect(
      await identifyImageSource(
        call,
        image.source_id!,
        image.external_revision!,
      ),
    ).toBe('png');
    expect(call.mock.calls[0]).toEqual([
      'identify_image_source',
      { sourceId: 'opaque', expectedRevision: image.external_revision },
    ]);
  });
  it('cancels the exact pending owner request and discards late output', async () => {
    let resolve!: (value: unknown) => void;
    const call = vi.fn((command: string) =>
      command === 'render_image_source'
        ? new Promise((r) => {
            resolve = r;
          })
        : Promise.resolve(true),
    );
    const abort = new AbortController();
    const pending = createImageGateway(call).render(session(), abort.signal);
    const rejected = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    abort.abort();
    resolve({});
    await rejected;
    expect(call.mock.calls.map((c) => c[0])).toEqual([
      'render_image_source',
      'cancel_image_render',
    ]);
  });
  it('rejects malformed or unrelated native results', async () => {
    await expect(
      createImageGateway(() => Promise.resolve({})).render(
        session(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('invalid bounded result');
  });
});

it.each([
  [
    { category: 'permission_revoked', retryable: false },
    'source_revoked',
    false,
  ],
  [{ category: 'conflict', retryable: true }, 'source_revised', true],
  [{ category: 'not_found', retryable: false }, 'source_read', false],
  [
    {
      category: 'unavailable',
      retryable: true,
      context: { image_stage: 'source_read' },
    },
    'source_read',
    true,
  ],
  [new Error('private path content://secret'), 'host_transport', true],
])(
  'classifies native failure without exposing its payload',
  async (failure, kind, retryable) => {
    const rejectNative = () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Native IPC rejects serialized CoreError records.
      return Promise.reject(failure);
    };
    try {
      await createImageGateway(rejectNative).render(
        session(),
        new AbortController().signal,
      );
    } catch (error) {
      expect(error).toMatchObject({ outcome: { kind, retryable } });
      expect(JSON.stringify(error)).not.toContain('content://secret');
      return;
    }
    throw new Error('Expected image failure');
  },
);

afterEach(() => vi.unstubAllEnvs());
it('uses an actual absent-native invocation once in a compiled probe, then the normal render path', async () => {
  vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
  const dispose = installRecoveryProbeListener(() => undefined);
  window.dispatchEvent(
    new CustomEvent('glitchpad:test-recovery', { detail: { stage: 'host' } }),
  );
  const call = vi.fn((command: string, args?: Record<string, unknown>) =>
    command === 'glitchpad_s047_absent_image_preview_probe'
      ? Promise.reject(new Error('native command not found'))
      : Promise.resolve({
          source_id: args!.sourceId,
          request_id: args!.requestId,
          external_revision: args!.expectedRevision,
          preview: null,
          failure: 'malformed',
          metadata: {
            observations: [],
            statuses: [],
            unknown_fields: 0,
            profile_present: false,
          },
        }),
  );
  try {
    const gateway = createImageGateway(call);
    await expect(
      gateway.render(session(), new AbortController().signal),
    ).rejects.toMatchObject({
      outcome: { kind: 'host_transport', retryable: true },
    });
    await expect(
      gateway.render(session(), new AbortController().signal),
    ).resolves.toMatchObject({ failure: 'malformed' });
    expect(call.mock.calls.map((c) => c[0])).toEqual([
      'glitchpad_s047_absent_image_preview_probe',
      'render_image_source',
    ]);
  } finally {
    dispose();
  }
});

it('preserves actual source-read rejection even when a provider returns unavailable', async () => {
  const native = () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Native IPC rejects serialized CoreError records.
    return Promise.reject({
      category: 'unavailable',
      retryable: false,
      context: { image_stage: 'source_read', reason: 'stream_failed' },
    });
  };
  await expect(
    createImageGateway(native).render(session(), new AbortController().signal),
  ).rejects.toMatchObject({
    outcome: { kind: 'source_read', retryable: false },
  });
});
