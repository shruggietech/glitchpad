import { invoke } from '@tauri-apps/api/core';

import type { RecoveryInventoryEntry, TextEncoding } from './contracts';

export interface RecoveryTextProfile {
  encoding: TextEncoding;
  bom: 'present' | 'absent' | 'unknown';
  newlines: 'lf' | 'crlf' | 'cr' | 'mixed' | 'none' | 'unknown';
  terminal_newline: 'present' | 'absent' | 'unknown';
  undecodable_bytes: 'none' | 'requires_user_decision' | 'unsupported';
}

export interface RecoveryRecordDraft {
  record_id: string;
  display_hint: string;
  source_identity_evidence: string;
  base_revision_evidence: string;
  saved_session_revision: number;
  snapshot_session_revision: number;
  text_profile: RecoveryTextProfile;
  created_unix_ms: number;
  updated_unix_ms: number;
  content: string;
  eviction_eligible: boolean;
}

export interface RecoveryRecord extends Omit<
  RecoveryRecordDraft,
  'source_identity_evidence' | 'base_revision_evidence'
> {
  schema_version: number;
  source_identity_hash: string;
  base_revision_hash: string;
  expires_unix_ms: number;
  content_sha256: string;
}

export interface RecoveryGateway {
  inventory(): Promise<RecoveryInventoryEntry[]>;
  persist(record: RecoveryRecordDraft): Promise<RecoveryInventoryEntry>;
  load(recordId: string): Promise<RecoveryRecord>;
  remove(recordId: string): Promise<boolean>;
}

export const nativeRecoveryAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const nativeRecoveryGateway: RecoveryGateway = {
  async inventory() {
    const [entries] =
      await invoke<[RecoveryInventoryEntry[], number, number]>(
        'inventory_recovery',
      );
    return entries;
  },
  persist: (record) =>
    invoke<RecoveryInventoryEntry>('persist_recovery', { record }),
  load: (recordId) => invoke<RecoveryRecord>('load_recovery', { recordId }),
  remove: (recordId) => invoke<boolean>('remove_recovery', { recordId }),
};
