import type { ShellSession } from './contracts';

export const DEFAULT_INLINE_TAB_CAPACITY = 5;
export const DESKTOP_CHROME_MAX_PX = 80;
export const REFERENCE_HEIGHT_PX = 800;

export interface TabState {
  sessions: ShellSession[];
  activeId: string | null;
  overflowOpen: boolean;
  announcement: string;
}

export type TabAction =
  | { type: 'open'; session: ShellSession }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string }
  | { type: 'reorder'; id: string; offset: -1 | 1 }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'toggle_overflow'; open?: boolean };

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
    })),
    activeId: active?.id ?? null,
    overflowOpen: false,
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
      return close(state, action.id);
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
  }
};

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
      revision:
        session.id === id || session.id === state.activeId
          ? session.revision + 1
          : session.revision,
    })),
  };
};

const close = (state: TabState, id: string): TabState => {
  const closingIndex = state.sessions.findIndex((session) => session.id === id);
  if (closingIndex < 0) return state;
  const closing = state.sessions[closingIndex];
  const sessions = state.sessions.filter((session) => session.id !== id);
  if (state.activeId !== id) {
    return {
      ...state,
      sessions,
      announcement: `${closing.source.display_name} closed`,
    };
  }
  const successor =
    sessions[Math.min(closingIndex, sessions.length - 1)] ?? null;
  return {
    ...state,
    sessions: sessions.map((session) => ({
      ...session,
      lifecycle: session.id === successor?.id ? 'active' : 'background',
    })),
    activeId: successor?.id ?? null,
    overflowOpen: false,
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
