import type { AndroidSourceSummary } from './contracts';
import {
  createNativeAndroidRestorationGateway,
  materializeAndroidSource,
} from './android-restoration-gateway';
import { EDITABLE_TEXT_MAX_BYTES, LARGE_TEXT_MAX_BYTES } from './text-document';
import type { SessionProjection } from './persistence';

const reference = '70cbf05c-53f5-5442-9ace-9d576529714c';

const source: AndroidSourceSummary = {
  source_id: 'native-source',
  descriptor: {
    identity: {
      authority: 'android_document',
      scope: 'private-scope',
      token: 'private-token',
      strength: 'strong',
    },
    restoration_reference: reference,
    display_name: 'restored.md',
    claimed_media_type: 'text/markdown',
    byte_length: 10,
    modified_unix_ms: 1,
    kind: 'document_uri',
    capabilities: {
      read: true,
      seek: true,
      stream: true,
      metadata: true,
      observe_revision: true,
      revalidate: true,
      watch: false,
      write: false,
      replace_atomically: false,
      persistent_permission: true,
      rename: false,
      observe_deletion: false,
      reopen: true,
      reveal_location: false,
    },
  },
  external_revision: {
    identity: {
      authority: 'android_document',
      scope: 'private-scope',
      token: 'private-token',
      strength: 'strong',
    },
    byte_length: 10,
    modified_unix_nanos: '1000000',
    change_token: 'safe-token',
  },
  delivery_kind: 'view',
  grant: {
    read: true,
    write: false,
    persisted_read: true,
    persisted_write: false,
    restorable: true,
  },
};

const projection: SessionProjection = {
  session_key: 'old-process-session-1',
  display_hint: 'restored.md',
  renderer_id: 'markdown',
  presentation_mode: 'source',
  source_reference: reference,
  recovery_record_id: null,
};

describe('Android startup restoration', () => {
  it.each(['known', 'unknown'])(
    'materializes a small %s-size source using native short-read EOF semantics',
    async (size) => {
      const raw =
        '# Small snapshot\n\n- list item\n\n| Column | Value |\n| --- | --- |\n| item | Ω |\n';
      const payload = new TextEncoder().encode(raw);
      const original = {
        ...source,
        descriptor: {
          ...source.descriptor,
          byte_length: size === 'known' ? payload.length : null,
        },
        external_revision: {
          ...source.external_revision,
          byte_length: size === 'known' ? payload.length : null,
        },
      };
      const call = vi.fn(
        (command: string, args?: Record<string, unknown>): Promise<unknown> => {
          if (command === 'identify_image_source') return Promise.resolve(null);
          if (command !== 'read_android_range')
            throw new Error('unexpected native command');
          const offset = args?.offset as number;
          const length = args?.length as number;
          const bytes = [...payload.slice(offset, offset + length)];
          return Promise.resolve({
            source_id: source.source_id,
            offset,
            bytes,
            end_of_source: bytes.length < length,
          });
        },
      );
      const session = await materializeAndroidSource(
        call,
        original,
        'markdown',
        'android',
      );
      expect(session.content).toBe(raw);
      expect(session.text_document).toMatchObject({
        mode: 'editable',
        source_bytes: payload.length,
        raw_text: raw,
      });
      expect(session.markdown_document).toMatchObject({
        mode: 'rendered',
        eligibility: 'full',
      });
      expect(session.source.byte_length).toBe(original.descriptor.byte_length);
      expect(session.source.capabilities.write).toBe(false);
    },
  );

  it.each([EDITABLE_TEXT_MAX_BYTES, EDITABLE_TEXT_MAX_BYTES + 1])(
    'distinguishes an unknown-size %s-byte source with one bounded EOF probe',
    async (actualBytes) => {
      const reads: Array<{
        offset: number;
        length: number;
        operationBudget: number;
      }> = [];
      const call = (
        command: string,
        args?: Record<string, unknown>,
      ): Promise<unknown> => {
        if (command === 'identify_image_source') return Promise.resolve(null);
        if (command !== 'read_android_range')
          throw new Error('unexpected native command');
        const read = args as {
          offset: number;
          length: number;
          operationBudget: number;
        };
        reads.push(read);
        const count = Math.max(
          0,
          Math.min(read.length, actualBytes - read.offset),
        );
        return Promise.resolve({
          source_id: source.source_id,
          offset: read.offset,
          bytes: Array<number>(count).fill(97),
          end_of_source: count < read.length,
        });
      };
      const original = {
        ...source,
        descriptor: { ...source.descriptor, byte_length: null },
        external_revision: { ...source.external_revision, byte_length: null },
      };
      const session = await materializeAndroidSource(
        call,
        original,
        'markdown',
        'android',
      );
      expect(session.text_document?.mode).toBe(
        actualBytes === EDITABLE_TEXT_MAX_BYTES
          ? 'editable'
          : 'large_read_only',
      );
      expect(session.text_document?.source_bytes).toBe(actualBytes);
      expect(session.content.length).toBe(
        actualBytes === EDITABLE_TEXT_MAX_BYTES ? actualBytes : 0,
      );
      expect(reads.at(-1)).toMatchObject({
        offset: EDITABLE_TEXT_MAX_BYTES,
        length: 1,
        operationBudget: 1,
      });
      expect(
        reads.every(
          (read) =>
            read.length <= 1024 * 1024 && read.operationBudget === read.length,
        ),
      ).toBe(true);
    },
  );

  it('keeps known oversized sources out of full-snapshot reads', async () => {
    const call = vi.fn((command: string): Promise<unknown> => {
      if (command === 'identify_image_source') return Promise.resolve(null);
      throw new Error(
        'oversized sources must not be read into a full snapshot',
      );
    });
    const original = {
      ...source,
      descriptor: {
        ...source.descriptor,
        byte_length: EDITABLE_TEXT_MAX_BYTES + 1,
      },
    };
    expect(
      (await materializeAndroidSource(call, original, 'markdown', 'android'))
        .text_document?.mode,
    ).toBe('large_read_only');
    expect(call).toHaveBeenCalledOnce();
    await expect(
      materializeAndroidSource(
        call,
        {
          ...source,
          descriptor: {
            ...source.descriptor,
            byte_length: LARGE_TEXT_MAX_BYTES + 1,
          },
        },
        'markdown',
        'android',
      ),
    ).rejects.toThrow('viewing limit');
  });

  it('routes content-verified image restoration without decoding text', async () => {
    const call = vi.fn((command: string) => {
      if (command === 'restore_android_sources')
        return Promise.resolve([
          { source, status: 'restored', display_name: 'restored.md' },
        ]);
      if (command === 'identify_image_source') return Promise.resolve('jpeg');
      throw new Error(`Unexpected image text read: ${command}`);
    });
    const sessions = await createNativeAndroidRestorationGateway(call).restore([
      { ...projection, renderer_id: 'image' },
    ]);
    expect(sessions[0]?.image_document?.codec).toBe('jpeg');
    expect(sessions[0]?.text_document).toBeNull();
    expect(sessions[0]?.renderer.capabilities.save).toBe(false);
  });
  it('reopens only projected durable sources and materializes their bounded content', async () => {
    const nativeCall = (command: string): Promise<unknown> => {
      if (command === 'identify_image_source') return Promise.resolve(null);
      if (command === 'restore_android_sources')
        return Promise.resolve([
          { source, status: 'restored', display_name: 'restored.md' },
        ]);
      if (command === 'read_android_range')
        return Promise.resolve({
          source_id: source.source_id,
          offset: 0,
          bytes: [...new TextEncoder().encode('# Restored')],
          end_of_source: true,
        });
      throw new Error(`Unexpected command: ${command}`);
    };
    const call = vi.fn(nativeCall);
    const gateway = createNativeAndroidRestorationGateway(call);

    const sessions = await gateway.restore([projection]);

    expect(call).toHaveBeenCalledWith('restore_android_sources');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'restored-native-source',
      content: '# Restored',
      source_id: 'native-source',
      dirty: false,
    });
    expect(sessions[0].id).not.toBe(projection.session_key);
    expect(sessions[0].source.restoration_reference).toBe(reference);
  });

  it('does not read a native source absent from the bounded projection', async () => {
    const nativeCall = (command: string): Promise<unknown> => {
      if (command === 'restore_android_sources')
        return Promise.resolve([
          { source, status: 'restored', display_name: 'restored.md' },
        ]);
      throw new Error('Unprojected source must not be read');
    };
    const call = vi.fn(nativeCall);

    await expect(
      createNativeAndroidRestorationGateway(call).restore([]),
    ).resolves.toEqual([]);
    expect(call).toHaveBeenCalledOnce();
  });
});
