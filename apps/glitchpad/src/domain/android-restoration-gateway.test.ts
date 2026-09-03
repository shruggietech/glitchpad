import type { AndroidSourceSummary } from './contracts';
import { createNativeAndroidRestorationGateway } from './android-restoration-gateway';
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
  it('reopens only projected durable sources and materializes their bounded content', async () => {
    const nativeCall = (command: string): Promise<unknown> => {
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

    await expect(createNativeAndroidRestorationGateway(call).restore([]))
      .resolves.toEqual([]);
    expect(call).toHaveBeenCalledOnce();
  });
});
