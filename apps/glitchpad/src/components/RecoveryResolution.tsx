import { useEffect, useRef, type KeyboardEvent } from 'react';

import type {
  DestructiveTransition,
  RecoveryInventoryEntry,
  ShellSession,
} from '../domain/contracts';
import {
  canSaveInPlace,
  integrityOf,
  type ResolutionDecision,
} from '../domain/recovery';

interface RecoveryResolutionProps {
  session: ShellSession;
  transition: DestructiveTransition;
  onDecision: (decision: ResolutionDecision) => void;
}

export type RecoveryCandidateDecision = 'recover' | 'refuse' | 'cancel';

interface RecoveryCandidateResolutionProps {
  entry: RecoveryInventoryEntry;
  onDecision: (decision: RecoveryCandidateDecision) => void;
}

export function RecoveryResolution({
  session,
  transition,
  onDecision,
}: RecoveryResolutionProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const returnTarget = document.activeElement;
    firstActionRef.current?.focus();
    return () => {
      if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
        returnTarget.focus();
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDecision('cancel');
      return;
    }
    if (event.key !== 'Tab') return;
    const actions = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      ) ?? [],
    );
    if (actions.length === 0) return;
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey
      ? (current - 1 + actions.length) % actions.length
      : (current + 1) % actions.length;
    event.preventDefault();
    actions[next]?.focus();
  };

  const saveInPlace = canSaveInPlace(session);
  const waitingForReceipt = transition.status === 'saving';
  const unsafe = integrityOf(session) === 'conflicted' || !saveInPlace;

  return (
    <div className="resolution-backdrop">
      <div
        ref={dialogRef}
        className="resolution-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolution-title"
        aria-describedby="resolution-description resolution-status"
        onKeyDown={handleKeyDown}
      >
        <h2 id="resolution-title">
          Unsaved changes in {session.source.display_name}
        </h2>
        <p id="resolution-description">
          {unsafe
            ? `The original source is not safe to update. Save a new copy, discard the local edits, or cancel ${transition.kind}.`
            : `Choose what to do with the local edits before ${transition.kind}.`}
        </p>
        <p id="resolution-status" className="resolution-status" role="status" aria-live="polite">
          {waitingForReceipt
            ? `${transition.save_intent === 'save' ? 'Save' : 'Save As'} requested. The document remains open until a durable receipt arrives.`
            : 'No content has been discarded.'}
        </p>
        <div className="resolution-actions">
          {saveInPlace && (
            <button
              ref={firstActionRef}
              type="button"
              disabled={waitingForReceipt}
              onClick={() => onDecision('save')}
            >
              Save
            </button>
          )}
          <button
            ref={saveInPlace ? undefined : firstActionRef}
            type="button"
            disabled={waitingForReceipt}
            onClick={() => onDecision('save_as')}
          >
            Save As
          </button>
          <button type="button" onClick={() => onDecision('discard')}>
            Discard
          </button>
          <button type="button" onClick={() => onDecision('cancel')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecoveryCandidateResolution({
  entry,
  onDecision,
}: RecoveryCandidateResolutionProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const returnTarget = document.activeElement;
    firstActionRef.current?.focus();
    return () => {
      if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
        returnTarget.focus();
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDecision('cancel');
      return;
    }
    if (event.key !== 'Tab') return;
    const actions = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    if (actions.length === 0) return;
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey
      ? (current - 1 + actions.length) % actions.length
      : (current + 1) % actions.length;
    event.preventDefault();
    actions[next]?.focus();
  };

  return (
    <div className="resolution-backdrop">
      <div
        ref={dialogRef}
        className="resolution-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-description"
        onKeyDown={handleKeyDown}
      >
        <h2 id="recovery-title">Recover {entry.display_hint}?</h2>
        <p id="recovery-description">
          Glitchpad found unsaved local edits after an abnormal shutdown. Recover them as a dirty document, explicitly decline this recovery, or decide later.
        </p>
        <div className="resolution-actions">
          <button
            ref={firstActionRef}
            type="button"
            onClick={() => onDecision('recover')}
          >
            Recover
          </button>
          <button type="button" onClick={() => onDecision('refuse')}>
            Decline recovery
          </button>
          <button type="button" onClick={() => onDecision('cancel')}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
