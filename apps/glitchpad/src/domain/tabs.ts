import type {
  DestructiveTransition,
  DestructiveTransitionKind,
  ShellSession,
} from './contracts';
import {
  canSaveInPlace,
  hasUnresolvedEdits,
  requestTransition,
  type ResolutionDecision,
} from './recovery';

export const DEFAULT_INLINE_TAB_CAPACITY = 5;
export const DESKTOP_CHROME_MAX_PX = 80;
export const REFERENCE_HEIGHT_PX = 800;

export interface TabState {
  sessions: ShellSession[];
  activeId: string | null;
  overflowOpen: boolean;
  announcement: string;
  pendingTransition: DestructiveTransition | null;
}

export type TabAction =
  | { type: 'open'; session: ShellSession }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string }
  | { type: 'request_transition'; id: string; kind: DestructiveTransitionKind }
  | { type: 'resolve_transition'; decision: ResolutionDecision }
  | { type: 'reorder'; id: string; offset: -1 | 1 }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'toggle_overflow'; open?: boolean }
  | {
      type: 'update_text';
      id: string;
      expectedRevision: number;
      revision: number;
      document: import('./contracts').TextDocumentState;
    }
  | {
      type: 'update_markdown';
      id: string;
      expectedRevision: number;
      markdown: import('./contracts').MarkdownDocumentState;
    }
  | {
      type: 'update_language';
      id: string;
      expectedRevision: number;
      language: import('./contracts').LanguageDecision;
    };

export interface TabProjection {
  inline: ShellSession[];
  overflow: ShellSession[];
}

export const createTabState = (sessions: ShellSession[]): TabState => {
  const active =
    sessions.find(({ lifecycle }) => lifecycle === 'active') ??
    sessions[0] ??
    null;
  return {
    sessions: sessions.map((session) => ({
      ...session,
      lifecycle: active && session.id === active.id ? 'active' : 'background',
      focus: active && session.id === active.id ? 'active' : 'background',
      integrity:
        session.integrity ??
        (session.lifecycle === 'conflicted'
          ? 'conflicted'
          : session.dirty
            ? 'dirty'
            : 'clean'),
    })),
    activeId: active?.id ?? null,
    overflowOpen: false,
    pendingTransition: null,
    announcement: active
      ? `${active.source.display_name} active`
      : 'No document is open',
  };
};

export const projectTabs = (
  state: TabState,
  capacity = DEFAULT_INLINE_TAB_CAPACITY,
): TabProjection => {
  const boundedCapacity = Math.max(1, capacity);
  if (state.sessions.length <= boundedCapacity) {
    return { inline: state.sessions, overflow: [] };
  }

  const activeIndex = state.sessions.findIndex(
    ({ id }) => id === state.activeId,
  );
  const selectedIndexes = new Set<number>();
  if (activeIndex >= 0) selectedIndexes.add(activeIndex);
  for (
    let distance = 0;
    selectedIndexes.size < boundedCapacity && distance < state.sessions.length;
    distance += 1
  ) {
    const before = activeIndex - distance;
    const after = activeIndex + distance;
    if (before >= 0) selectedIndexes.add(before);
    if (selectedIndexes.size < boundedCapacity && after < state.sessions.length)
      selectedIndexes.add(after);
  }

  return {
    inline: state.sessions.filter((_, index) => selectedIndexes.has(index)),
    overflow: state.sessions.filter((_, index) => !selectedIndexes.has(index)),
  };
};

export const tabReducer = (state: TabState, action: TabAction): TabState => {
  switch (action.type) {
    case 'open': {
      const existing = state.sessions.find(
        ({ id }) => id === action.session.id,
      );
      if (existing) return activate(state, existing.id);
      return activate(
        { ...state, sessions: [...state.sessions, action.session] },
        action.session.id,
      );
    }
    case 'activate':
      return activate(state, action.id);
    case 'close':
      return requestDestructiveTransition(state, action.id, 'close');
    case 'request_transition':
      return requestDestructiveTransition(state, action.id, action.kind);
    case 'resolve_transition':
      return resolveTransition(state, action.decision);
    case 'reorder':
      return reorder(state, action.id, action.offset);
    case 'next':
      return cycle(state, 1);
    case 'previous':
      return cycle(state, -1);
    case 'first':
      return state.sessions[0] ? activate(state, state.sessions[0].id) : state;
    case 'last': {
      const last = state.sessions.at(-1);
      return last ? activate(state, last.id) : state;
    }
    case 'toggle_overflow':
      return { ...state, overflowOpen: action.open ?? !state.overflowOpen };
    case 'update_text':
      return updateText(state, action);
    case 'update_markdown':
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.id && session.revision === action.expectedRevision
            ? { ...session, markdown_document: action.markdown }
            : session,
        ),
      };
    case 'update_language':
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.id && session.revision === action.expectedRevision && session.text_document
            ? { ...session, text_document: { ...session.text_document, language: action.language } }
            : session,
        ),
      };
  }
};

const updateText = (
  state: TabState,
  action: Extract<TabAction, { type: 'update_text' }>,
): TabState => ({
  ...state,
  sessions: state.sessions.map((session) =>
    session.id === action.id && session.revision === action.expectedRevision
      ? {
          ...session,
          content: action.document.normalized_text,
          text_document: action.document,
          revision: action.revision,
          dirty: true,
          integrity: 'dirty',
          pending_save: null,
          recovery_coverage: 'stale',
        }
      : session,
  ),
});

const activate = (state: TabState, id: string): TabState => {
  const target = state.sessions.find((session) => session.id === id);
  if (!target) return state;
  return {
    ...state,
    activeId: id,
    overflowOpen: false,
    announcement: `${target.source.display_name} active`,
    sessions: state.sessions.map((session) => ({
      ...session,
      lifecycle: session.id === id ? 'active' : 'background',
      focus: session.id === id ? 'active' : 'background',
    })),
  };
};

const requestDestructiveTransition = (
  state: TabState,
  id: string,
  kind: DestructiveTransitionKind,
): TabState => {
  if (state.pendingTransition) return state;
  const target = state.sessions.find((session) => session.id === id);
  if (!target) return state;
  if (!hasUnresolvedEdits(target)) return completeTransition(state, id, kind);
  return {
    ...state,
    pendingTransition: requestTransition(target, kind),
    announcement: `${target.source.display_name} has unsaved changes. Choose how to continue.`,
  };
};

const resolveTransition = (
  state: TabState,
  decision: ResolutionDecision,
): TabState => {
  const transition = state.pendingTransition;
  if (!transition) return state;
  const target = state.sessions.find(
    ({ id }) => id === transition.target_session_id,
  );
  if (!target) return { ...state, pendingTransition: null };
  if (target.revision !== transition.requested_session_revision) {
    return {
      ...state,
      pendingTransition: requestTransition(target, transition.kind),
      announcement: `${target.source.display_name} changed while the decision was open. Review the current unsaved changes.`,
    };
  }
  if (decision === 'cancel') {
    return {
      ...state,
      pendingTransition: null,
      announcement: `${transition.kind} cancelled. ${target.source.display_name} remains open with unsaved changes.`,
    };
  }
  if (decision === 'discard') {
    return completeTransition(
      { ...state, pendingTransition: null },
      target.id,
      transition.kind,
    );
  }
  if (decision === 'save' && !canSaveInPlace(target)) {
    return {
      ...state,
      announcement: `In-place save is unavailable for ${target.source.display_name}. Use Save As, discard, or cancel.`,
    };
  }
  const label = decision === 'save' ? 'Save' : 'Save As';
  return {
    ...state,
    pendingTransition: {
      ...transition,
      status: 'saving',
      save_intent: decision,
    },
    announcement: `${label} requested for ${target.source.display_name}. Waiting for a durable save receipt; the document remains open.`,
  };
};

const completeTransition = (
  state: TabState,
  id: string,
  kind: DestructiveTransitionKind,
): TabState => {
  if (kind !== 'reload') return disposeSession(state, id, kind);
  const target = state.sessions.find((session) => session.id === id);
  if (!target) return state;
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === id
        ? {
            ...session,
            dirty: false,
            integrity: 'clean',
            pending_save: null,
            recovery_coverage: 'none',
          }
        : session,
    ),
    pendingTransition: null,
    announcement: `${target.source.display_name} reload authorized after resolving local edits.`,
  };
};

const disposeSession = (
  state: TabState,
  id: string,
  kind: DestructiveTransitionKind,
): TabState => {
  const closingIndex = state.sessions.findIndex((session) => session.id === id);
  if (closingIndex < 0) return state;
  const closing = state.sessions[closingIndex];
  const sessions = state.sessions.filter((session) => session.id !== id);
  if (state.activeId !== id) {
    return {
      ...state,
      sessions,
      pendingTransition: null,
      announcement: `${closing.source.display_name} ${kind === 'close' ? 'closed' : `${kind} resolved`}`,
    };
  }
  const successor =
    sessions[Math.min(closingIndex, sessions.length - 1)] ?? null;
  return {
    ...state,
    sessions: sessions.map((session) => ({
      ...session,
      lifecycle: session.id === successor?.id ? 'active' : 'background',
      focus: session.id === successor?.id ? 'active' : 'background',
    })),
    activeId: successor?.id ?? null,
    overflowOpen: false,
    pendingTransition: null,
    announcement: successor
      ? `${closing.source.display_name} closed. ${successor.source.display_name} active`
      : 'No document is open',
  };
};

const reorder = (state: TabState, id: string, offset: -1 | 1): TabState => {
  const sourceIndex = state.sessions.findIndex((session) => session.id === id);
  const destination = sourceIndex + offset;
  if (
    sourceIndex < 0 ||
    destination < 0 ||
    destination >= state.sessions.length
  )
    return state;
  const sessions = [...state.sessions];
  const [session] = sessions.splice(sourceIndex, 1);
  if (!session) return state;
  sessions.splice(destination, 0, session);
  return {
    ...state,
    sessions,
    announcement: `${session.source.display_name} moved to position ${destination + 1}`,
  };
};

const cycle = (state: TabState, offset: -1 | 1): TabState => {
  if (state.sessions.length === 0) return state;
  const current = Math.max(
    0,
    state.sessions.findIndex(({ id }) => id === state.activeId),
  );
  const destination =
    (current + offset + state.sessions.length) % state.sessions.length;
  const target = state.sessions[destination];
  return target ? activate(state, target.id) : state;
};
