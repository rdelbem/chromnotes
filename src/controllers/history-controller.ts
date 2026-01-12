import { createStore } from "zustand/vanilla";
import { SerializedEditorData } from "../types";

const HISTORY_LIMIT = 5;
const SNAPSHOT_DELAY_MS = 2000;

export type NoteSnapshot = {
  title: string;
  category: string;
  content: string;
  contentRaw: SerializedEditorData | null;
};

type SnapshotProvider = () => NoteSnapshot;

type NoteHistory = {
  past: NoteSnapshot[];
  future: NoteSnapshot[];
  timerId: number | null;
  pendingProvider: SnapshotProvider | null;
};

type HistoryState = {
  byNoteId: Record<string, NoteHistory>;
};

const store = createStore<HistoryState>(() => ({
  byNoteId: {}
}));

function getHistory(noteId: string): NoteHistory {
  const state = store.getState();
  const existing = state.byNoteId[noteId];
  if (existing) {
    return existing;
  }
  const history: NoteHistory = {
    past: [],
    future: [],
    timerId: null,
    pendingProvider: null
  };
  store.setState({
    byNoteId: {
      ...state.byNoteId,
      [noteId]: history
    }
  });
  return history;
}

function areSnapshotsEqual(a: NoteSnapshot | null, b: NoteSnapshot | null): boolean {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.category === b.category &&
    a.content === b.content &&
    JSON.stringify(a.contentRaw ?? null) === JSON.stringify(b.contentRaw ?? null)
  );
}

function pushSnapshot(noteId: string, snapshot: NoteSnapshot): void {
  const history = getHistory(noteId);
  const last = history.past[history.past.length - 1] ?? null;
  if (areSnapshotsEqual(last, snapshot)) {
    return;
  }
  const nextPast = [...history.past.slice(-(HISTORY_LIMIT - 1)), snapshot];
  const nextHistory: NoteHistory = {
    ...history,
    past: nextPast,
    future: []
  };
  store.setState((state) => ({
    byNoteId: {
      ...state.byNoteId,
      [noteId]: nextHistory
    }
  }));
}

function clearTimer(noteId: string): void {
  const history = getHistory(noteId);
  if (history.timerId !== null) {
    window.clearTimeout(history.timerId);
    history.timerId = null;
  }
  history.pendingProvider = null;
}

export function queueHistorySnapshot(noteId: string | null, provider: SnapshotProvider): void {
  if (!noteId) {
    return;
  }
  const history = getHistory(noteId);
  if (history.timerId !== null) {
    window.clearTimeout(history.timerId);
  }
  history.pendingProvider = provider;
  history.timerId = window.setTimeout(() => {
    const snapshot = history.pendingProvider?.();
    clearTimer(noteId);
    if (snapshot) {
      pushSnapshot(noteId, snapshot);
    }
  }, SNAPSHOT_DELAY_MS);
}

export function flushHistorySnapshot(noteId: string | null): void {
  if (!noteId) {
    return;
  }
  const history = getHistory(noteId);
  if (history.timerId === null || !history.pendingProvider) {
    return;
  }
  const snapshot = history.pendingProvider();
  clearTimer(noteId);
  pushSnapshot(noteId, snapshot);
}

export function primeHistory(noteId: string | null, provider: SnapshotProvider): void {
  if (!noteId) {
    return;
  }
  const history = getHistory(noteId);
  if (history.past.length) {
    return;
  }
  const snapshot = provider();
  pushSnapshot(noteId, snapshot);
}

export function undoNoteChange(
  noteId: string | null,
  currentSnapshot: NoteSnapshot
): NoteSnapshot | null {
  if (!noteId) {
    return null;
  }
  flushHistorySnapshot(noteId);
  const history = getHistory(noteId);
  if (history.past.length < 2) {
    return null;
  }
  const previousIndex = history.past.length - 2;
  const target = history.past[previousIndex];
  const nextPast = history.past.slice(0, previousIndex + 1);
  const nextFuture = [...history.future, currentSnapshot].slice(-(HISTORY_LIMIT - 1));
  store.setState((state) => ({
    byNoteId: {
      ...state.byNoteId,
      [noteId]: {
        ...history,
        past: nextPast,
        future: nextFuture,
        timerId: null,
        pendingProvider: null
      }
    }
  }));
  return target;
}

export function redoNoteChange(
  noteId: string | null,
  currentSnapshot: NoteSnapshot
): NoteSnapshot | null {
  if (!noteId) {
    return null;
  }
  flushHistorySnapshot(noteId);
  const history = getHistory(noteId);
  const next = history.future[history.future.length - 1];
  if (!next) {
    return null;
  }
  const trimmedFuture = history.future.slice(0, history.future.length - 1);
  const nextPast = [...history.past, currentSnapshot].slice(-(HISTORY_LIMIT - 1));
  store.setState((state) => ({
    byNoteId: {
      ...state.byNoteId,
      [noteId]: {
        ...history,
        past: nextPast,
        future: trimmedFuture,
        timerId: null,
        pendingProvider: null
      }
    }
  }));
  return next;
}
