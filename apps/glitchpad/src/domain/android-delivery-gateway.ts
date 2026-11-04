import { pickerCancelled } from './android-authoring-gateway';

import {
  addPluginListener,
  invoke,
  type PluginListener,
} from '@tauri-apps/api/core';

import type {
  AndroidDeliveryDrain,
  AndroidSourceSummary,
  ShellSession,
} from './contracts';
import {
  materializeAndroidSource,
  rendererForAndroidSource,
  type NativeInvoke,
} from './android-restoration-gateway';

export interface AndroidDeliveryGateway {
  choose?(): Promise<AndroidSourceSummary | null>;
  subscribeBack?(handler: (requestId: string) => void): Promise<() => void>;
  completeBack?(requestId: string, handled: boolean): Promise<void>;
  close(sourceId: string): Promise<void>;
  drain(): Promise<AndroidDeliveryDrain>;
  materialize(source: AndroidSourceSummary): Promise<ShellSession>;
  subscribe(handler: () => void): Promise<() => void>;
}

export const nativeAndroidDeliveryAvailable = (): boolean => {
  if (typeof window === 'undefined' || !/android/iu.test(navigator.userAgent))
    return false;
  const internals = (
    window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: unknown };
    }
  ).__TAURI_INTERNALS__;
  return typeof internals?.invoke === 'function';
};

export const createNativeAndroidDeliveryGateway = (
  call: NativeInvoke = invoke,
  subscribeEvent: (handler: () => void) => Promise<PluginListener> = (
    handler,
  ) =>
    addPluginListener('glitchpad-android-source', 'deliveriesReady', handler),
): AndroidDeliveryGateway => ({
  async choose() {
    try {
      return (await call('open_android_document', {
        mediaType: null,
      })) as AndroidSourceSummary;
    } catch (error) {
      if (pickerCancelled(error)) return null;
      throw error;
    }
  },
  async subscribeBack(handler) {
    const listener = await addPluginListener<{ requestId: string }>(
      'glitchpad-android-source',
      'androidBackRequested',
      (value) => handler(value.requestId),
    );
    return () => {
      void listener.unregister();
    };
  },
  async completeBack(requestId, handled) {
    await call('complete_android_back', { requestId, handled });
  },
  async close(sourceId) {
    await call('close_android_source', { sourceId });
  },
  async drain() {
    const sources: AndroidSourceSummary[] = [];
    const rejections: AndroidDeliveryDrain['rejections'] = [];
    for (;;) {
      const batch = (await call('drain_android_deliveries', {
        maximum: 64,
      })) as AndroidDeliveryDrain;
      sources.push(...batch.sources);
      rejections.push(...batch.rejections);
      if (batch.sources.length + batch.rejections.length < 64)
        return { sources, rejections };
    }
  },
  materialize(source) {
    return materializeAndroidSource(
      call,
      source,
      rendererForAndroidSource(source.descriptor.display_name),
      'android',
    );
  },
  async subscribe(handler) {
    const listener = await subscribeEvent(handler);
    return () => {
      void listener.unregister();
    };
  },
});

export const nativeAndroidDeliveryGateway =
  createNativeAndroidDeliveryGateway();
