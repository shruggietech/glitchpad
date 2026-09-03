import { invoke } from '@tauri-apps/api/core';

import type { SourceDescriptor } from './contracts';

export interface MarkdownExternalLinkGateway {
  open(normalizedTarget: string): Promise<void>;
}

export interface MarkdownLocalAssetGateway {
  resolve(
    source: SourceDescriptor,
    normalizedTarget: string,
    signal?: AbortSignal,
  ): Promise<string | null>;
}

export const nativeExternalLinkAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const nativeMarkdownExternalLinkGateway: MarkdownExternalLinkGateway = {
  open: (normalizedTarget) =>
    invoke<void>('open_external_link', { target: normalizedTarget }),
};

export const unavailableMarkdownExternalLinkGateway: MarkdownExternalLinkGateway = {
  open: () => Promise.reject(new Error('External navigation is unavailable')),
};

export const unavailableMarkdownLocalAssetGateway: MarkdownLocalAssetGateway = {
  resolve: () => Promise.resolve(null),
};
