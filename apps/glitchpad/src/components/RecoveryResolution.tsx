import { useRef } from 'react';
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
import { TaskSurface } from './TaskSurface';
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
  const opener = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const saveInPlace = canSaveInPlace(session),
    waitingForReceipt = transition.status === 'saving';
  const unsafe = integrityOf(session) === 'conflicted' || !saveInPlace;
  return (
    <TaskSurface
      open
      title={'Unsaved changes in ' + session.source.display_name}
      className="resolution-dialog"
      priority="decision"
      showClose={false}
      canClose={!waitingForReceipt}
      opener={opener.current}
      onOpenChange={(open) => {
        if (!open && !waitingForReceipt) onDecision('cancel');
      }}
    >
      <p id="resolution-description">
        {unsafe
          ? `The original source is not safe to update. Save a new copy, discard the local edits, or cancel ${transition.kind}.`
          : `Choose what to do with the local edits before ${transition.kind}.`}
      </p>
      <p
        id="resolution-status"
        className="resolution-status"
        role="status"
        aria-live="polite"
      >
        {waitingForReceipt
          ? `${transition.save_intent === 'save' ? 'Save' : 'Save As'} requested. The document remains open until a durable receipt arrives.`
          : 'No content has been discarded.'}
      </p>
      <div className="resolution-actions">
        {saveInPlace && (
          <button
            data-task-initial-focus
            type="button"
            disabled={waitingForReceipt}
            onClick={() => onDecision('save')}
          >
            Save
          </button>
        )}
        <button
          data-task-initial-focus={saveInPlace ? undefined : true}
          type="button"
          disabled={waitingForReceipt}
          onClick={() => onDecision('save_as')}
        >
          Save As
        </button>
        <button
          type="button"
          disabled={waitingForReceipt}
          onClick={() => onDecision('discard')}
        >
          Discard
        </button>
        <button
          type="button"
          disabled={waitingForReceipt}
          onClick={() => onDecision('cancel')}
        >
          Cancel
        </button>
      </div>
    </TaskSurface>
  );
}
export function RecoveryCandidateResolution({
  entry,
  onDecision,
}: RecoveryCandidateResolutionProps) {
  const opener = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (
    <TaskSurface
      open
      title={'Recover ' + entry.display_hint + '?'}
      className="resolution-dialog"
      priority="decision"
      showClose={false}
      opener={opener.current}
      onOpenChange={(open) => {
        if (!open) onDecision('cancel');
      }}
    >
      <p id="recovery-description">
        Glitchpad found unsaved local edits after an abnormal shutdown. Recover
        them as a dirty document, explicitly decline this recovery, or decide
        later.
      </p>
      <div className="resolution-actions">
        <button
          data-task-initial-focus
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
    </TaskSurface>
  );
}
