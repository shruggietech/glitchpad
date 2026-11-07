import { invoke } from '@tauri-apps/api/core';

import { nativeAndroidDeliveryAvailable } from './android-delivery-gateway';

export const clipboardTextAvailable = (): boolean =>
  nativeAndroidDeliveryAvailable() ||
  (typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.writeText === 'function');

export const writeClipboardText = (text: string): Promise<void> => {
  if (nativeAndroidDeliveryAvailable())
    return invoke<void>('write_android_clipboard', { text });
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
    return Promise.reject(new Error('clipboard_unavailable'));
  return navigator.clipboard.writeText(text);
};
