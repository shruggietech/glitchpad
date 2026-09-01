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

  if (state.sessions.length === 0) return null;

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

  const active = state.sessions.find(({ id }) => id === state.activeId) ?? null;

  return (
    <div className="tab-strip-shell">
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
              {session.dirty && (
                <span className="dirty-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          className="active-tab-actions"
          aria-label={`Actions for ${active.source.display_name}`}
          role="group"
        >
          <button
            className="tab-action"
            type="button"
            aria-label={`Move ${active.source.display_name} left`}
            onClick={() =>
              dispatch({ type: 'reorder', id: active.id, offset: -1 })
            }
          >
            ‹
          </button>
          <button
            className="tab-action"
            type="button"
            aria-label={`Move ${active.source.display_name} right`}
            onClick={() =>
              dispatch({ type: 'reorder', id: active.id, offset: 1 })
            }
          >
            ›
          </button>
          <button
            className="tab-action close-tab"
            type="button"
            aria-label={`Close ${active.source.display_name}`}
            onClick={() => dispatch({ type: 'close', id: active.id })}
          >
            ×
          </button>
        </div>
      )}
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
                <button
                  type="button"
                  role="menuitem"
                  key={session.id}
                  onClick={() => dispatch({ type: 'activate', id: session.id })}
                >
                  {session.source.display_name}
                  {session.dirty ? ' (unsaved)' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
