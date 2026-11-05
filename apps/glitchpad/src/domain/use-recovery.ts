import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecoveryInventoryEntry, ShellSession } from './contracts';
import type {
  RecoveryGateway,
  RecoveryRecord,
  RecoveryRecordDraft,
} from './recovery-gateway';
import { projectRecoveryInventory } from './recovery';

let retainedRestartListener: ((event: Event) => void) | null = null;

const IDLE_SNAPSHOT_MS = 2_000;
const MAX_SNAPSHOT_MS = 30_000;
const CLEANUP_RETRY_MS = 30_000;
const CLEANUP_WARNING =
  'Resolved recovery cleanup is pending and will be retried safely.';

export const createRecoveryRecordId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

export const buildRecoveryRecordDraft = (
  session: ShellSession,
  recordId: string,
  createdUnixMs: number,
  now: number,
): RecoveryRecordDraft => {
  const savedRevision =
    session.saved_revision ?? Math.max(0, session.revision - 1);
  const snapshotRevision = Math.max(session.revision, savedRevision + 1);
  const document = session.text_document;
  const record: RecoveryRecordDraft = {
    record_id: recordId,
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
    created_unix_ms: createdUnixMs,
    updated_unix_ms: now,
    content: document?.raw_text ?? session.content,
    eviction_eligible: false,
  };

  return record;
};

interface RecordBinding {
  recordId: string;
  createdUnixMs: number;
  lastSnapshotRevision: number | null;
  pendingRevision?: number;
  pending?: Promise<void>;
}

export interface RecoveryController {
  candidates: RecoveryInventoryEntry[];
  recordIds: ReadonlyMap<string, string>;
  warning: string | null;
  flush(): Promise<void>;
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
  const [recordIds, setRecordIds] = useState(new Map<string, string>());
  const bindings = useRef(new Map<string, RecordBinding>());
  const pendingAcceptedSessions = useRef(new Set<string>());
  const pendingCleanups = useRef(new Set<string>());
  const cleanupInFlight = useRef(new Set<string>());
  const writes = useRef(new Map<string, Promise<void>>());
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
      void (writes.current.get(recordId) ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => gateway.remove(recordId))
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
    (session: ShellSession): Promise<void> => {
      if (!session.dirty) return Promise.resolve();
      if (!gateway) return Promise.reject(new Error('recovery_unavailable'));
      const existing = bindings.current.get(session.id);
      if (existing?.pendingRevision === session.revision && existing.pending)
        return existing.pending;
      if (existing?.lastSnapshotRevision === session.revision)
        return Promise.resolve();
      const now = Date.now();
      const binding: RecordBinding = existing ?? {
        recordId: createRecoveryRecordId(),
        createdUnixMs: now,
        lastSnapshotRevision: null,
      };
      bindings.current.set(session.id, binding);
      const record = buildRecoveryRecordDraft(
        session,
        binding.recordId,
        binding.createdUnixMs,
        now,
      );
      const pending = (
        writes.current.get(binding.recordId) ?? Promise.resolve()
      )
        .catch(() => undefined)
        .then(() => gateway.persist(record))
        .then(() => {
          if (bindings.current.get(session.id) !== binding) return;
          binding.lastSnapshotRevision = session.revision;
          setRecordIds((current) => {
            if (current.get(session.id) === binding.recordId) return current;
            return new Map(current).set(session.id, binding.recordId);
          });
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
          throw new Error('recovery_write_failed');
        });
      binding.pendingRevision = session.revision;
      binding.pending = pending;
      writes.current.set(binding.recordId, pending);
      const clearPending = () => {
        if (writes.current.get(binding.recordId) === pending)
          writes.current.delete(binding.recordId);
        if (binding.pending === pending) {
          binding.pending = undefined;
          binding.pendingRevision = undefined;
        }
      };
      void pending.then(clearPending, clearPending);
      return pending;
    },
    [gateway],
  );

  const flush = useCallback(async () => {
    await Promise.all(sessionsRef.current.filter((s) => s.dirty).map(persist));
  }, [persist]);

  useEffect(() => {
    if (retainedRestartListener) {
      window.removeEventListener(
        'glitchpad:before-restart',
        retainedRestartListener,
      );
      retainedRestartListener = null;
    }
    const suspend = () => {
      void flush().catch(() => undefined);
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') suspend();
    };
    const restart = (event: Event) => {
      (
        event as CustomEvent<{ waitUntil(promise: Promise<unknown>): void }>
      ).detail.waitUntil(flush());
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('glitchpad:before-restart', restart);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('glitchpad:before-restart', restart);
      void flush().catch(() => undefined);
      retainedRestartListener = (event: Event) => {
        (
          event as CustomEvent<{ waitUntil(promise: Promise<unknown>): void }>
        ).detail.waitUntil(flush());
      };
      window.addEventListener(
        'glitchpad:before-restart',
        retainedRestartListener,
      );
    };
  }, [flush]);

  useEffect(() => {
    if (!gateway) return;
    const dirtyIds = new Set(
      sessions.filter(({ dirty }) => dirty).map(({ id }) => id),
    );
    const sessionIds = new Set(sessions.map(({ id }) => id));
    sessionIds.forEach((sessionId) =>
      pendingAcceptedSessions.current.delete(sessionId),
    );
    for (const [sessionId, binding] of bindings.current) {
      if (dirtyIds.has(sessionId)) continue;
      if (pendingAcceptedSessions.current.has(sessionId)) continue;
      bindings.current.delete(sessionId);
      setRecordIds((current) => {
        if (!current.has(sessionId)) return current;
        const next = new Map(current);
        next.delete(sessionId);
        return next;
      });
      pendingCleanups.current.add(binding.recordId);
      attemptCleanup(binding.recordId);
    }
    const timers = sessions
      .filter(({ dirty }) => dirty)
      .map((session) =>
        setTimeout(() => {
          void persist(session).catch(() => undefined);
        }, IDLE_SNAPSHOT_MS),
      );
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
      void flush().catch(() => undefined);
    }, MAX_SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [flush, gateway]);

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
    recordIds,
    warning: warning || null,
    flush,
    async accept(entry) {
      const record = await gateway!.load(entry.record_id);
      const sessionId = `recovery-${entry.record_id}`;
      bindings.current.set(sessionId, {
        recordId: entry.record_id,
        createdUnixMs: record.created_unix_ms,
        lastSnapshotRevision: record.snapshot_session_revision,
      });
      pendingAcceptedSessions.current.add(sessionId);
      setRecordIds((current) =>
        new Map(current).set(sessionId, entry.record_id),
      );
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
