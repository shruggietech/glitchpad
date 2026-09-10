import type { PluginListener } from '@tauri-apps/api/core';

import type { AndroidSourceSummary } from './contracts';
import { createNativeAndroidDeliveryGateway } from './android-delivery-gateway';

const bytes = [...new TextEncoder().encode('# Opened')];
const source: AndroidSourceSummary = {
  source_id: 'android-source',
  descriptor: {
    identity: {
      authority: 'android_document',
      scope: 'private-scope',
      token: 'private-token',
      strength: 'strong',
    },
    restoration_reference: null,
    display_name: 'opened.md',
    claimed_media_type: 'text/markdown',
    byte_length: bytes.length,
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
      persistent_permission: false,
      rename: false,
      observe_deletion: false,
      reopen: false,
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
    byte_length: bytes.length,
    modified_unix_nanos: '1000000',
    change_token: 'safe-token',
  },
  delivery_kind: 'view',
  grant: {
    read: true,
    write: false,
    persisted_read: false,
    persisted_write: false,
    restorable: false,
  },
};

describe('Android delivery gateway', () => {
  it('drains, materializes, observes, and closes Android sources', async () => {
    const nativeCall = vi.fn((command: string): Promise<unknown> => {
      if (command === 'drain_android_deliveries')
        return Promise.resolve({ sources: [source], rejections: [] });
      if (command === 'read_android_range')
        return Promise.resolve({
          source_id: source.source_id,
          offset: 0,
          bytes,
          end_of_source: true,
        });
      if (command === 'close_android_source') return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const unregister = vi.fn().mockResolvedValue(undefined);
    const listener: PluginListener = {
      plugin: 'android-source',
      event: 'deliveriesReady',
      channelId: 1,
      unregister,
    };
    const subscribe = vi.fn().mockResolvedValue(listener);
    const gateway = createNativeAndroidDeliveryGateway(nativeCall, subscribe);

    const delivery = await gateway.drain();
    const session = await gateway.materialize(delivery.sources[0]);
    const dispose = await gateway.subscribe(vi.fn());
    dispose();
    await gateway.close(source.source_id);

    expect(nativeCall).toHaveBeenCalledWith('drain_android_deliveries', {
      maximum: 64,
    });
    expect(session).toMatchObject({
      id: 'android-android-source',
      content: '# Opened',
      source_id: 'android-source',
      renderer: { id: 'markdown' },
    });
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(nativeCall).toHaveBeenCalledWith('close_android_source', {
      sourceId: 'android-source',
    });
  });
});
