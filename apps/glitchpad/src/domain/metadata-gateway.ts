import { invoke } from '@tauri-apps/api/core';

import type {
  ExternalRevision,
  IntegrityProgress,
  IntegrityStartRequest,
  SourceId,
  SourceMetadataSnapshot,
} from './contracts';

export interface ClipboardGateway {
  write(text: string): Promise<void>;
}

export const browserClipboardGateway: ClipboardGateway = {
  write: (text) => {
    if (!navigator.clipboard) return Promise.reject(new Error('clipboard_unavailable'));
    return navigator.clipboard.writeText(text);
  },
};

export class MemoryClipboardGateway implements ClipboardGateway {
  value = '';
  write(text: string): Promise<void> {
    this.value = text;
    return Promise.resolve();
  }
}

export interface MetadataGateway {
  query(sourceId: SourceId, signal?: AbortSignal): Promise<SourceMetadataSnapshot>;
  startIntegrity(
    request: IntegrityStartRequest,
    signal?: AbortSignal,
  ): Promise<IntegrityProgress>;
  advanceIntegrity(requestId: string, signal?: AbortSignal): Promise<IntegrityProgress>;
  cancelIntegrity(requestId: string): Promise<void>;
}

const abortError = () => new DOMException('Operation cancelled', 'AbortError');
const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

export const createNativeMetadataGateway = (
  android = typeof navigator !== 'undefined' && /android/iu.test(navigator.userAgent),
): MetadataGateway => ({
  async query(sourceId, signal) {
    throwIfAborted(signal);
    const result = await invoke<SourceMetadataSnapshot>(
      android ? 'query_android_metadata' : 'query_source_metadata',
      { sourceId },
    );
    throwIfAborted(signal);
    return result;
  },
  async startIntegrity(request, signal) {
    throwIfAborted(signal);
    const result = await invoke<IntegrityProgress>(
      android ? 'start_android_integrity' : 'start_source_integrity',
      {
        sourceId: request.source_id,
        expectedRevision: request.expected_external_revision,
        requestId: request.request_id,
      },
    );
    throwIfAborted(signal);
    return result;
  },
  async advanceIntegrity(requestId, signal) {
    throwIfAborted(signal);
    const result = await invoke<IntegrityProgress>(
      android ? 'advance_android_integrity' : 'advance_source_integrity',
      { requestId },
    );
    throwIfAborted(signal);
    return result;
  },
  async cancelIntegrity(requestId) {
    await invoke<void>(android ? 'cancel_android_integrity' : 'cancel_source_integrity', { requestId });
  },
});

const terminal = new Set(['ready', 'stale', 'limited', 'cancelled', 'failed']);

export const runIntegrityRequest = async (
  gateway: MetadataGateway,
  sourceId: SourceId,
  expectedRevision: ExternalRevision,
  requestId: string,
  signal?: AbortSignal,
  onProgress?: (progress: IntegrityProgress) => void,
): Promise<IntegrityProgress> => {
  let started = false;
  try {
    throwIfAborted(signal);
    let progress = await gateway.startIntegrity({
      request_id: requestId,
      source_id: sourceId,
      expected_external_revision: expectedRevision,
    }, signal);
    started = true;
    validateIntegrityProgress(progress, requestId, sourceId, expectedRevision);
    onProgress?.(progress);
    while (!terminal.has(progress.state)) {
      throwIfAborted(signal);
      progress = await gateway.advanceIntegrity(requestId, signal);
      validateIntegrityProgress(progress, requestId, sourceId, expectedRevision);
      onProgress?.(progress);
    }
    if (progress.state === 'ready' && !/^[a-f0-9]{64}$/u.test(progress.sha256 ?? ''))
      throw new Error('integrity_digest_invalid');
    return progress;
  } catch (error) {
    if (started) await gateway.cancelIntegrity(requestId).catch(() => undefined);
    throw error;
  }
};

const validateIntegrityProgress = (
  progress: IntegrityProgress,
  requestId: string,
  sourceId: SourceId,
  expectedRevision: ExternalRevision,
) => {
  if (
    progress.request_id !== requestId ||
    progress.source_id !== sourceId ||
    JSON.stringify(progress.external_revision) !== JSON.stringify(expectedRevision)
  ) throw new Error('integrity_response_mismatch');
};

export const nativeMetadataAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
