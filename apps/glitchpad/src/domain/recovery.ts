import {
  noRendererCapabilities,
  noSourceCapabilities,
  type DestructiveTransition,
  type DestructiveTransitionKind,
  type RecoveryInventoryEntry,
  type SessionIntegrity,
  type ShellSession,
} from './contracts';
import type { RecoveryTextProfile } from './recovery-gateway';
import { detectLanguage } from './language';
import { createTextDocument } from './text-document';

export type ResolutionDecision = 'save' | 'save_as' | 'discard' | 'cancel';

export interface RecoveryPayload {
  inventory: RecoveryInventoryEntry;
  content: string;
  snapshot_session_revision: number;
  text_profile: RecoveryTextProfile;
}

export interface RecoveryInventoryProjection {
  available: RecoveryInventoryEntry[];
  notices: string[];
}

export const projectRecoveryInventory = (
  entries: RecoveryInventoryEntry[],
): RecoveryInventoryProjection => {
  const available = [...entries]
    .filter(({ status }) => status === 'available')
    .sort((left, right) => right.updated_unix_ms - left.updated_unix_ms);
  const count = (status: RecoveryInventoryEntry['status']) =>
    entries.filter((entry) => entry.status === status).length;
  const notices: string[] = [];
  const corrupted = count('corrupted');
  const expired = count('expired');
  const unsupported = count('unsupported');
  const atRisk = count('coverage_at_risk');
  if (corrupted > 0)
    notices.push(`${corrupted} corrupted recovery record isolated.`);
  if (expired > 0) notices.push(`${expired} expired recovery record removed.`);
  if (unsupported > 0)
    notices.push(
      `${unsupported} newer recovery record preserved but not opened.`,
    );
  if (atRisk > 0)
    notices.push(`${atRisk} dirty session has recovery coverage at risk.`);
  return { available, notices };
};

export const integrityOf = (session: ShellSession): SessionIntegrity => {
  if (session.integrity) return session.integrity;
  if (session.lifecycle === 'conflicted') return 'conflicted';
  return session.dirty ? 'dirty' : 'clean';
};

export const hasUnresolvedEdits = (session: ShellSession): boolean =>
  integrityOf(session) !== 'clean';

export const canSaveInPlace = (session: ShellSession): boolean => {
  const integrity = integrityOf(session);
  return (
    (integrity === 'dirty' || integrity === 'saving') &&
    (session.source_state ?? 'available') === 'available' &&
    session.source.capabilities.write &&
    session.source.capabilities.revalidate
  );
};

export const requestTransition = (
  session: ShellSession,
  kind: DestructiveTransitionKind,
): DestructiveTransition => ({
  kind,
  target_session_id: session.id,
  requested_session_revision: session.revision,
  status: 'awaiting_decision',
  save_intent: null,
});

export const projectRecoveredSession = ({
  inventory,
  content,
  snapshot_session_revision,
  text_profile,
}: RecoveryPayload): ShellSession => {
  const document = createTextDocument({
    rawText: content,
    displayName: inventory.display_hint,
    encoding: text_profile.encoding,
    undecodableBytes: text_profile.undecodable_bytes,
    language: detectLanguage(inventory.display_hint, content),
  });
  return {
    id: `recovery-${inventory.record_id}`,
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'recovery',
        token: inventory.record_id,
        strength: 'unavailable',
      },
      display_name: inventory.display_hint,
      claimed_media_type: 'text/plain',
      byte_length: document.source_bytes,
      modified_unix_ms: inventory.updated_unix_ms,
      kind: 'memory',
      capabilities: { ...noSourceCapabilities(), read: true },
    },
    renderer: {
      id: 'recovered-text',
      label: 'Recovered text',
      capabilities: {
        ...noRendererCapabilities(),
        view: true,
        edit: true,
        copy: true,
        save: true,
      },
    },
    lifecycle: 'background',
    focus: 'background',
    integrity: 'recovery_only',
    source_state: 'unavailable',
    dirty: true,
    revision: snapshot_session_revision,
    recovery_coverage: 'current',
    recovery_warning_code: null,
    content: document.normalized_text,
    text_document: document,
  };
};
