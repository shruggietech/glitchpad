import { invoke } from '@tauri-apps/api/core';
import type {
  AndroidDestinationReceipt,
  AndroidSaveAsReceipt,
  ShellSession,
} from './contracts';
import type { NativeInvoke } from './android-restoration-gateway';
import { serializeTextDocument } from './text-document';
import {
  markSaveObservation,
  observeCreateInvoke,
} from './save-observation-probes';

export const pickerCancelled = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return error === 'picker_cancelled';
  const e = error as { code?: string; context?: { reason?: string } };
  return (
    e.code === 'picker_cancelled' || e.context?.reason === 'picker_cancelled'
  );
};

const SAVE_FAILURE_REASONS = new Set([
  'destination_conflict',
  'original_destination_denied',
  'independent_destination_required',
  'permission_revoked',
  'source_not_found',
  'write_verification_failed',
  'budget_exceeded',
  'picker_failed',
  'provider_unavailable',
  'invalid_receipt',
  'serialization_failed',
  'source_changed',
]);
export const saveFailureReason = (error: unknown): string => {
  if (typeof error === 'string')
    return SAVE_FAILURE_REASONS.has(error) ? error : 'write_failed';
  if (!error || typeof error !== 'object') return 'write_failed';
  const value = error as {
    context?: { reason?: unknown };
    category?: unknown;
    message?: unknown;
  };
  const reason = value.context?.reason ?? value.message;
  if (typeof reason === 'string' && SAVE_FAILURE_REASONS.has(reason))
    return reason;
  if (value.category === 'conflict') return 'source_changed';
  if (value.category === 'permission_revoked') return 'permission_revoked';
  if (value.category === 'not_found') return 'source_not_found';
  if (value.category === 'budget_exceeded') return 'budget_exceeded';
  return 'write_failed';
};
export const saveFailureMessage = (reason: string): string => {
  if (reason === 'destination_conflict')
    return 'That destination already contains a document. Choose a new name or another destination. Your edits remain open.';
  if (
    reason === 'original_destination_denied' ||
    reason === 'independent_destination_required'
  )
    return 'Choose a different destination to keep the original unchanged. Your edits remain open.';
  if (reason === 'permission_revoked' || reason === 'source_not_found')
    return 'Source access is unavailable. Select the source again, then save a copy to a new destination. Your edits remain open.';
  if (reason === 'source_changed')
    return 'The source changed. Open it again to review the changes, then save a copy to a new destination. Your edits remain open.';
  if (reason === 'budget_exceeded')
    return 'This document exceeds the native save limit. Keep it open and copy smaller sections to another document.';
  if (reason === 'invalid_receipt' || reason === 'write_verification_failed')
    return 'The destination write could not be verified. Choose another destination or try again. Your edits remain open.';
  return 'Save did not complete. Try again or choose another destination. Your edits remain open.';
};
const suggestedDestinationName = (displayName: string): string => {
  let name = '';
  for (const character of displayName.replace(/[/\\\p{Cc}]/gu, '_')) {
    if (name.length + character.length > 128) break;
    name += character;
  }
  return name || 'document.txt';
};

export interface AndroidAuthoringGateway {
  saveAs(session: ShellSession): Promise<AndroidDestinationReceipt | null>;
}
export const createAndroidAuthoringGateway = (
  call: NativeInvoke = invoke,
): AndroidAuthoringGateway => ({
  async saveAs(session) {
    if (!session.text_document) throw new Error('text_required');
    const serialized = serializeTextDocument(
      session.text_document,
      session.revision,
      session.revision,
    );
    if (!serialized.ok) throw new Error('serialization_failed');
    const bytes = [...serialized.payload.bytes];
    const suggested_name = suggestedDestinationName(
      session.source.display_name,
    );
    const media_type = session.markdown_document
      ? 'text/markdown'
      : 'text/plain';
    try {
      const origin =
        session.source_id && session.external_revision
          ? {
              source_id: session.source_id,
              external_revision: session.external_revision,
            }
          : session.copy_source;
      if (origin) {
        const words = crypto.getRandomValues(new Uint32Array(2));
        const receipt = (await call('save_android_source_as', {
          request: {
            operation_id: (
              (BigInt(words[0]) << 32n) |
              BigInt(words[1])
            ).toString(),
            source_id: origin.source_id,
            expected_external_revision: origin.external_revision,
            suggested_name,
            media_type,
            bytes,
          },
        })) as AndroidSaveAsReceipt;
        if (
          receipt.previous_source_id !== origin.source_id ||
          receipt.byte_count !== bytes.length
        )
          throw new Error('invalid_receipt');
        return {
          source: receipt.new_source,
          byte_count: receipt.byte_count,
          saved_revision: session.revision,
        };
      }
      const receipt = (await observeCreateInvoke(session, () =>
        call('create_android_document', {
          request: {
            bytes,
            suggested_name,
            media_type,
            session_revision: session.revision,
          },
        }),
      )) as AndroidDestinationReceipt;
      markSaveObservation(session, 'create_invoke_resolved');
      if (
        receipt.saved_revision !== session.revision ||
        receipt.byte_count !== bytes.length ||
        !receipt.source?.source_id
      )
        throw new Error('invalid_receipt');
      return receipt;
    } catch (error) {
      markSaveObservation(session, 'create_gateway_catch');
      if (pickerCancelled(error)) {
        markSaveObservation(session, 'picker_cancelled_classified');
        return null;
      }
      throw error;
    }
  },
});
export const nativeAndroidAuthoringGateway = createAndroidAuthoringGateway();
