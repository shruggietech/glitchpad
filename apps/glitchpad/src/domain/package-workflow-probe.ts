import { invoke } from '@tauri-apps/api/core';
import contract from '../../../../packaging/desktop/document-workflow-probe.json';
import {
  createDesktopDeliveryGateway,
  createDesktopSaveOperationId,
  type DesktopDeliveryResult,
} from './desktop-delivery-gateway';
import { createNativeMetadataGateway } from './metadata-gateway';
import { nativeRecoveryGateway } from './recovery-gateway';
import { projectRecoveredSession } from './recovery';
import { applyTextTransaction } from './text-document';
import { createTabState, tabReducer } from './tabs';
import {
  buildRecoveryRecordDraft,
  createRecoveryRecordId,
} from './use-recovery';
import type {
  ExternalRevision,
  RevalidationResult,
  ShellSession,
  SourceMetadataSnapshot,
} from './contracts';

const requireProof = (value: unknown): void => {
  if (!value) throw new Error('packaged_document_workflow_failed');
};
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
// Metadata intentionally replaces filesystem identity with a path-free source token.
const matchesMetadataRevision = (
  snapshot: SourceMetadataSnapshot,
  revision: ExternalRevision,
) =>
  snapshot.external_revision.identity.authority === 'filesystem' &&
  snapshot.external_revision.identity.scope === 'desktop_source' &&
  snapshot.external_revision.identity.token === snapshot.source_id &&
  snapshot.external_revision.identity.strength === revision.identity.strength &&
  snapshot.external_revision.byte_length === revision.byte_length &&
  String(snapshot.external_revision.modified_unix_nanos) ===
    String(revision.modified_unix_nanos) &&
  /^sha256:[a-f0-9]{64}$/u.test(snapshot.external_revision.change_token ?? '');

/** Runs only when the native host returns its explicitly enabled, fixed synthetic fixture. */
export async function runPackageWorkflowProbe(): Promise<boolean> {
  const delivery = await invoke<DesktopDeliveryResult | null>(
    'begin_desktop_document_workflow_probe',
  );
  if (!delivery) return false;
  const source = delivery.source;
  requireProof(source && source.descriptor.display_name === contract.filename);
  const sourceId = source!.source_id;
  const gateway = createDesktopDeliveryGateway();
  const metadata = createNativeMetadataGateway(false);
  const mark = async (
    check: 'read' | 'edit' | 'save' | 'metadata' | 'recovery',
  ) =>
    requireProof(
      await invoke<boolean>('record_desktop_lifecycle_probe', {
        event: 'document-workflow-' + check,
        sequence: null,
      }),
    );
  let recordId: string | null = null;
  let persisted = false;
  let operationFailure: { error: unknown } | null = null;
  try {
    const initial = await gateway.materialize(delivery);
    requireProof(
      initial?.content === contract.initial_text &&
        initial.text_document?.mode === 'editable',
    );
    const original = initial!;
    await mark('read');
    const before = await metadata.query(sourceId);
    requireProof(
      before.source_id === sourceId &&
        before.source_kind === 'file' &&
        before.display_name === contract.filename &&
        Number(before.byte_length) ===
          new TextEncoder().encode(contract.initial_text).length &&
        before.write_state === 'writable' &&
        before.identity_confidence === 'strong' &&
        matchesMetadataRevision(before, original.external_revision!),
    );
    const edited = applyTextTransaction(
      original.text_document!,
      original.revision,
      original.revision,
      [
        {
          from: 0,
          to: original.text_document!.normalized_text.length,
          insert: contract.saved_text,
        },
      ],
    );
    if (!edited.ok) throw new Error('packaged_document_workflow_failed');
    let state = tabReducer(createTabState([original]), {
      type: 'update_text',
      id: original.id,
      expectedRevision: original.revision,
      revision: edited.revision,
      document: edited.document,
    });
    const dirty = state.sessions[0];
    requireProof(
      dirty.dirty &&
        dirty.integrity === 'dirty' &&
        dirty.content === contract.saved_text,
    );
    await mark('edit');
    recordId = createRecoveryRecordId();
    const now = Date.now();
    const draft = buildRecoveryRecordDraft(dirty, recordId, now, now);
    const inventory = await nativeRecoveryGateway.persist(draft);
    persisted = true;
    requireProof(
      inventory.record_id === recordId && inventory.status === 'available',
    );
    requireProof(
      (await nativeRecoveryGateway.inventory()).some(
        (entry) => entry.record_id === recordId && entry.status === 'available',
      ),
    );
    const recovered = await nativeRecoveryGateway.load(recordId);
    requireProof(
      recovered.content === contract.saved_text &&
        recovered.snapshot_session_revision === dirty.revision &&
        same(recovered.text_profile, draft.text_profile),
    );
    const projected = projectRecoveredSession({
      inventory,
      content: recovered.content,
      snapshot_session_revision: recovered.snapshot_session_revision,
      text_profile: recovered.text_profile,
    });
    requireProof(
      projected.integrity === 'recovery_only' &&
        projected.content === contract.saved_text,
    );
    await mark('recovery');
    const operationId = createDesktopSaveOperationId();
    state = tabReducer(state, {
      type: 'destination_save_started',
      id: dirty.id,
      revision: dirty.revision,
      operationId,
    });
    const saving = state.sessions[0];
    requireProof(
      saving.destination_save_revision === dirty.revision &&
        saving.destination_save_operation_id === operationId,
    );
    const saved = await gateway.save(saving);
    const count = new TextEncoder().encode(contract.saved_text).length;
    requireProof(
      saved.operation_id === operationId &&
        saved.source_id === sourceId &&
        saved.accepted_session_revision === dirty.revision &&
        saved.byte_count === count &&
        same(saved.previous_external_revision, original.external_revision) &&
        ['atomic_file_and_directory', 'atomic_file'].includes(saved.durability),
    );
    state = tabReducer(state, {
      type: 'save_completed',
      id: dirty.id,
      receipt: saved,
    });
    state = tabReducer(state, {
      type: 'destination_save_finished',
      id: dirty.id,
    });
    const clean: ShellSession = state.sessions[0];
    requireProof(
      !clean.dirty &&
        clean.destination_save_revision === null &&
        clean.destination_save_operation_id === null &&
        clean.saved_revision === dirty.revision &&
        same(clean.external_revision, saved.new_external_revision),
    );
    const after = await metadata.query(sourceId);
    requireProof(
      after.source_id === sourceId &&
        Number(after.byte_length) === count &&
        after.write_state === 'writable' &&
        after.identity_confidence === 'strong' &&
        matchesMetadataRevision(after, saved.new_external_revision) &&
        !same(before.external_revision, after.external_revision),
    );
    await mark('metadata');
    const revalidated = await invoke<RevalidationResult>('revalidate_source', {
      sourceId,
      expected: saved.new_external_revision,
    });
    requireProof(
      revalidated.source_id === sourceId &&
        revalidated.status === 'match' &&
        same(revalidated.current, saved.new_external_revision),
    );
    const reread = await gateway.materialize({
      ...delivery,
      source: {
        ...source!,
        descriptor: { ...source!.descriptor, byte_length: count },
        external_revision: saved.new_external_revision,
      },
    });
    requireProof(
      reread?.content === contract.saved_text &&
        reread.text_document?.raw_text === contract.saved_text,
    );
    await mark('save');
  } catch (error) {
    operationFailure = { error };
  }
  const attemptCleanup = async (
    action: () => Promise<void>,
  ): Promise<{ error: unknown } | null> => {
    try {
      await action();
      return null;
    } catch (error) {
      await action().catch(() => undefined);
      return { error };
    }
  };
  const recoveryFailure = await attemptCleanup(async () => {
    if (!recordId) return;
    const removed = await nativeRecoveryGateway.remove(recordId);
    requireProof(!persisted || removed);
    requireProof(
      !(await nativeRecoveryGateway.inventory()).some(
        (entry) => entry.record_id === recordId,
      ),
    );
  });
  const sourceFailure = await attemptCleanup(() => gateway.close(sourceId));
  if (operationFailure) throw operationFailure.error;
  if (recoveryFailure) throw recoveryFailure.error;
  if (sourceFailure) throw sourceFailure.error;
  requireProof(
    await invoke<boolean>('complete_desktop_document_workflow_probe'),
  );
  requireProof(
    await invoke<boolean>('record_desktop_lifecycle_probe', {
      event: 'document-workflow-ready',
      sequence: null,
    }),
  );
  return true;
}

export const reportPackageWorkflowFailure = (): Promise<boolean> =>
  invoke('record_desktop_lifecycle_probe', {
    event: 'document-workflow-failed',
    sequence: null,
  });
