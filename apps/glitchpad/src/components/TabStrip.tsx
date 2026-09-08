import { useEffect, useRef, type KeyboardEvent } from 'react';

import type { TabAction, TabState } from '../domain/tabs';
import { projectTabs } from '../domain/tabs';

interface TabStripProps {
  state: TabState;
  dispatch: (action: TabAction) => void;
}

export function TabStrip({ state, dispatch }: TabStripProps) {
  const projection = projectTabs(state);
  const previousActive = useRef(state.activeId);

  useEffect(() => {
    if (previousActive.current !== state.activeId && state.activeId) {
      document.getElementById(`tab-${state.activeId}`)?.focus();
    }
    previousActive.current = state.activeId;
  }, [state.activeId]);

  if (state.sessions.length < 2) return null;

  const handleTabKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (
      event.altKey &&
      event.shiftKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      dispatch({
        type: 'reorder',
        id,
        offset: event.key === 'ArrowLeft' ? -1 : 1,
      });
      return;
    }
    const action =
      event.key === 'ArrowLeft'
        ? 'previous'
        : event.key === 'ArrowRight'
          ? 'next'
          : event.key === 'Home'
            ? 'first'
            : event.key === 'End'
              ? 'last'
              : null;
    if (action) {
      event.preventDefault();
      dispatch({ type: action });
    }
  };

  return (
    <div className="tab-strip-shell">
      <div className="tab-list-shell">
        <div className="tab-list" role="tablist" aria-label="Open documents">
          {projection.inline.map((session) => {
            const selected = session.id === state.activeId;
            const name = `${session.source.display_name}${session.dirty ? ', unsaved changes' : ''}`;
            return (
              <button
                type="button"
                className={`tab-button${selected ? ' active' : ''}`}
                id={`tab-${session.id}`}
                role="tab"
                key={session.id}
                aria-selected={selected}
                aria-controls={`panel-${session.id}`}
                aria-label={name}
                tabIndex={selected ? 0 : -1}
                onClick={() => dispatch({ type: 'activate', id: session.id })}
                onKeyDown={(event) => handleTabKey(event, session.id)}
              >
                <span className="tab-name">{session.source.display_name}</span>
                {session.dirty && <span className="dirty-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="tab-close-list" aria-label="Close open documents">
          {projection.inline.map((session) => (
            <div className={`tab-close-slot${session.id === state.activeId ? ' active' : ''}`} key={session.id}>
              <button
                className="tab-close"
                type="button"
                aria-label={`Close ${session.source.display_name}`}
                onClick={() => dispatch({ type: 'close', id: session.id })}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      {projection.overflow.length > 0 && (
        <div className="overflow-shell">
          <button
            className="overflow-trigger"
            type="button"
            aria-label={`${projection.overflow.length} more open documents`}
            aria-haspopup="menu"
            aria-expanded={state.overflowOpen}
            onClick={() => dispatch({ type: 'toggle_overflow' })}
          >
            +{projection.overflow.length}
          </button>
          {state.overflowOpen && (
            <div
              className="overflow-menu"
              role="menu"
              aria-label="Overflow documents"
            >
              {projection.overflow.map((session) => (
                <div className="overflow-item" key={session.id}>
                  <button type="button" role="menuitem" onClick={() => dispatch({ type: 'activate', id: session.id })}>
                    {session.source.display_name}{session.dirty ? ' (unsaved)' : ''}
                  </button>
                  <button type="button" role="menuitem" aria-label={`Close ${session.source.display_name}`} onClick={() => dispatch({ type: 'close', id: session.id })}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
