import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecoveryInventoryEntry, ShellSession } from './contracts';
import type {
  RecoveryGateway,
  RecoveryRecord,
  RecoveryRecordDraft,
} from './recovery-gateway';
import { projectRecoveryInventory } from './recovery';

const IDLE_SNAPSHOT_MS = 2_000;
const MAX_SNAPSHOT_MS = 30_000;
const CLEANUP_RETRY_MS = 30_000;
const CLEANUP_WARNING =
  'Resolved recovery cleanup is pending and will be retried safely.';

const createRecordId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

interface RecordBinding {
  recordId: string;
  createdUnixMs: number;
  lastSnapshotRevision: number | null;
}

export interface RecoveryController {
  candidates: RecoveryInventoryEntry[];
  warning: string | null;
  accept(entry: RecoveryInventoryEntry): Promise<RecoveryRecord>;
  refuse(entry: RecoveryInventoryEntry): Promise<void>;
  defer(entry: RecoveryInventoryEntry): void;
}

export const useRecovery = (
  sessions: ShellSession[],
  gateway: RecoveryGateway | null,
): RecoveryController => {
  const [candidates, setCandidates] = useState<RecoveryInventoryEntry[]>([]);
  const [inventoryWarning, setInventoryWarning] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  const [snapshotWarnings, setSnapshotWarnings] = useState(
    new Map<string, string>(),
  );
  const bindings = useRef(new Map<string, RecordBinding>());
  const pendingCleanups = useRef(new Set<string>());
  const cleanupInFlight = useRef(new Set<string>());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  useEffect(() => {
    if (!gateway) return;
    let active = true;
    void gateway
      .inventory()
      .then((entries) => {
        if (!active) return;
        const projection = projectRecoveryInventory(entries);
        setCandidates(projection.available);
        setInventoryWarning(
          projection.notices.length > 0 ? projection.notices.join(' ') : null,
        );
      })
      .catch(() => {
        if (active)
          setInventoryWarning(
            'Recovery inventory is unavailable. Dirty content remains open.',
          );
      });
    return () => {
      active = false;
    };
  }, [gateway]);

  const attemptCleanup = useCallback(
    (recordId: string) => {
      if (
        !gateway ||
        !pendingCleanups.current.has(recordId) ||
        cleanupInFlight.current.has(recordId)
      )
        return;
      cleanupInFlight.current.add(recordId);
      void gateway
        .remove(recordId)
        .then(() => {
          pendingCleanups.current.delete(recordId);
          if (pendingCleanups.current.size === 0) setCleanupWarning(null);
        })
        .catch(() => setCleanupWarning(CLEANUP_WARNING))
        .finally(() => cleanupInFlight.current.delete(recordId));
    },
    [gateway],
  );

  const persist = useCallback(
    (session: ShellSession) => {
      if (!gateway || !session.dirty) return;
      const existing = bindings.current.get(session.id);
      if (existing?.lastSnapshotRevision === session.revision) return;
      const now = Date.now();
      const binding = existing ?? {
        recordId: createRecordId(),
        createdUnixMs: now,
        lastSnapshotRevision: null,
      };
      bindings.current.set(session.id, binding);
      const savedRevision =
        session.saved_revision ?? Math.max(0, session.revision - 1);
      const snapshotRevision = Math.max(session.revision, savedRevision + 1);
      const document = session.text_document;
      const record: RecoveryRecordDraft = {
        record_id: binding.recordId,
        display_hint: session.source.display_name,
        source_identity_evidence: JSON.stringify(session.source.identity),
        base_revision_evidence: JSON.stringify(
          session.external_revision ?? {
            byte_length: session.source.byte_length,
            modified_unix_ms: session.source.modified_unix_ms,
          },
        ),
        saved_session_revision: savedRevision,
        snapshot_session_revision: snapshotRevision,
        text_profile: {
          encoding: document?.profile.encoding ?? 'utf8',
          bom: document?.profile.bom ?? 'absent',
          newlines: document?.profile.newline_pattern ?? 'lf',
          terminal_newline:
            document?.profile.terminal_newline === null
              ? 'unknown'
              : (document?.profile.terminal_newline ??
                  session.content.endsWith('\n'))
                ? 'present'
                : 'absent',
          undecodable_bytes: document?.profile.undecodable_bytes ?? 'none',
        },
        created_unix_ms: binding.createdUnixMs,
        updated_unix_ms: now,
        content: document?.raw_text ?? session.content,
        eviction_eligible: false,
      };
      void gateway
        .persist(record)
        .then(() => {
          binding.lastSnapshotRevision = session.revision;
          setSnapshotWarnings((current) => {
            if (!current.has(session.id)) return current;
            const next = new Map(current);
            next.delete(session.id);
            return next;
          });
        })
        .catch(() => {
          setSnapshotWarnings((current) =>
            new Map(current).set(
              session.id,
              `Recovery coverage is at risk for ${session.source.display_name}. Keep the document open and free private storage before retrying.`,
            ),
          );
        });
    },
    [gateway],
  );

  useEffect(() => {
    if (!gateway) return;
    const dirtyIds = new Set(
      sessions.filter(({ dirty }) => dirty).map(({ id }) => id),
    );
    for (const [sessionId, binding] of bindings.current) {
      if (dirtyIds.has(sessionId)) continue;
      bindings.current.delete(sessionId);
      pendingCleanups.current.add(binding.recordId);
      attemptCleanup(binding.recordId);
    }
    const timers = sessions
      .filter(({ dirty }) => dirty)
      .map((session) => setTimeout(() => persist(session), IDLE_SNAPSHOT_MS));
    return () => timers.forEach(clearTimeout);
  }, [attemptCleanup, gateway, persist, sessions]);

  useEffect(() => {
    if (!gateway) return;
    const timer = setInterval(() => {
      pendingCleanups.current.forEach(attemptCleanup);
    }, CLEANUP_RETRY_MS);
    return () => clearInterval(timer);
  }, [attemptCleanup, gateway]);

  useEffect(() => {
    if (!gateway) return;
    const timer = setInterval(() => {
      sessionsRef.current.filter(({ dirty }) => dirty).forEach(persist);
    }, MAX_SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [gateway, persist]);

  const dismiss = (recordId: string) =>
    setCandidates((entries) =>
      entries.filter(({ record_id }) => record_id !== recordId),
    );

  const warning = [
    inventoryWarning,
    cleanupWarning,
    ...snapshotWarnings.values(),
  ]
    .filter((message): message is string => message !== null)
    .join(' ');

  return {
    candidates,
    warning: warning || null,
    async accept(entry) {
      const record = await gateway!.load(entry.record_id);
      bindings.current.set(`recovery-${entry.record_id}`, {
        recordId: entry.record_id,
        createdUnixMs: record.created_unix_ms,
        lastSnapshotRevision: record.snapshot_session_revision,
      });
      dismiss(entry.record_id);
      return record;
    },
    async refuse(entry) {
      await gateway!.remove(entry.record_id);
      dismiss(entry.record_id);
    },
    defer(entry) {
      dismiss(entry.record_id);
    },
  };
};
