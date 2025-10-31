import {
  ChromnotesState,
  Note,
  STORAGE_FALLBACK_KEY,
  defaultState,
  Theme,
  THEMES
} from "./types";

let state: ChromnotesState = { ...defaultState };

const supportsChromeLocal =
  typeof chrome !== "undefined" &&
  Boolean(chrome.storage?.local?.get) &&
  Boolean(chrome.storage?.local?.set);

const supportsChromeSync =
  typeof chrome !== "undefined" &&
  Boolean(chrome.storage?.sync?.get) &&
  Boolean(chrome.storage?.sync?.set);

let activeChromeStorage: "sync" | "local" = supportsChromeSync ? "sync" : "local";

const THEME_SET = new Set<Theme>(THEMES);

function sanitizeNotes(notes: unknown): Note[] {
  if (!Array.isArray(notes)) {
    return [];
  }
  return notes
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<Note>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.createdAt !== "number" ||
        typeof candidate.updatedAt !== "number"
      ) {
        return null;
      }
      return {
        id: candidate.id,
        title: typeof candidate.title === "string" ? candidate.title : "",
        content: typeof candidate.content === "string" ? candidate.content : "",
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        category:
          typeof (candidate as { category?: unknown }).category === "string"
            ? ((candidate as { category?: string }).category ?? "").trim()
            : ""
      };
    })
    .filter((note): note is Note => note !== null);
}

function buildCategoryIndex(notes: Note[]): Record<string, string[]> {
  return notes.reduce<Record<string, string[]>>((acc, note) => {
    const category = note.category.trim();
    if (!category) {
      return acc;
    }
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(note.id);
    return acc;
  }, {});
}

function isValidTheme(theme: unknown): theme is Theme {
  return typeof theme === "string" && THEME_SET.has(theme as Theme);
}

function coerceTheme(theme: unknown): Theme {
  if (isValidTheme(theme)) {
    return theme;
  }
  return defaultState.theme;
}

function normalizeNotesPerPage(value?: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return defaultState.notesPerPage;
  }
  return Math.max(1, Math.floor(value!));
}

function computeTotalPages(notes: Note[], notesPerPage: number): number {
  if (!notesPerPage || notesPerPage <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(notes.length / notesPerPage));
}

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.min(Math.floor(page), totalPages);
}

function getStorageArea(mode: "sync" | "local"): chrome.storage.StorageArea | null {
  if (mode === "sync" && supportsChromeSync) {
    return chrome.storage.sync;
  }
  if (mode === "local" && supportsChromeLocal) {
    return chrome.storage.local;
  }
  return null;
}

function normalizeState(partial?: Partial<ChromnotesState>): ChromnotesState {
  const sanitizedNotes = sanitizeNotes(partial?.notes);
  const notesPerPage = normalizeNotesPerPage(partial?.notesPerPage);
  const totalPages = computeTotalPages(sanitizedNotes, notesPerPage);
  const viewMode =
    partial?.viewMode === "desktop" || partial?.viewMode === "list"
      ? partial.viewMode
      : defaultState.viewMode;

  return {
    notes: sanitizedNotes,
    categoryIndex: buildCategoryIndex(sanitizedNotes),
    theme: coerceTheme(partial?.theme),
    selectedNoteId:
      typeof partial?.selectedNoteId === "string"
        ? partial.selectedNoteId
        : null,
    notesPerPage,
    currentPage: clampPage(partial?.currentPage ?? defaultState.currentPage, totalPages),
    compactView: Boolean(partial?.compactView),
    useChromeSync:
      supportsChromeSync && typeof partial?.useChromeSync === "boolean"
        ? partial.useChromeSync
        : false,
    activeCategory:
      typeof partial?.activeCategory === "string" && partial.activeCategory.trim().length
        ? partial.activeCategory.trim()
        : null,
    viewMode
  };
}

async function readFromChromeStorage(
  mode: "sync" | "local"
): Promise<Partial<ChromnotesState> | null> {
  const area = getStorageArea(mode);
  if (!area) {
    return null;
  }

  return new Promise<Partial<ChromnotesState> | null>((resolve) => {
    try {
      area.get(
        [
          "notes",
          "theme",
          "selectedNoteId",
          "currentPage",
          "notesPerPage",
          "compactView",
          "useChromeSync",
          "activeCategory",
          "viewMode",
          "categoryIndex"
        ],
        (items) => {
          if (chrome.runtime?.lastError) {
            console.warn(
              `Chromnotes: chrome.storage.${mode}.get failed.`,
              chrome.runtime.lastError
            );
            resolve(null);
            return;
          }
          resolve(items as Partial<ChromnotesState>);
        }
      );
    } catch (error) {
      console.warn(
        `Chromnotes: chrome.storage.${mode} unavailable.`,
        error
      );
      resolve(null);
    }
  });
}

async function writeToChromeStorage(
  mode: "sync" | "local",
  payload: ChromnotesState
): Promise<boolean> {
  const area = getStorageArea(mode);
  if (!area) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      area.set(payload, () => {
        if (chrome.runtime?.lastError) {
          console.warn(
            `Chromnotes: chrome.storage.${mode}.set failed.`,
            chrome.runtime.lastError
          );
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      console.warn(
        `Chromnotes: chrome.storage.${mode} unavailable.`,
        error
      );
      resolve(false);
    }
  });
}

export function getState(): ChromnotesState {
  return state;
}

export function updateState(
  partial: Partial<ChromnotesState>
): ChromnotesState {
  const merged: ChromnotesState = {
    ...state,
    ...partial
  } as ChromnotesState;

  if (isValidTheme(partial.theme)) {
    merged.theme = partial.theme;
  } else if (!isValidTheme(merged.theme)) {
    merged.theme = state.theme;
  }

  merged.notesPerPage = normalizeNotesPerPage(partial.notesPerPage ?? state.notesPerPage);
  merged.notes = partial.notes ? sanitizeNotes(partial.notes) : merged.notes;
  merged.categoryIndex = buildCategoryIndex(merged.notes);

  const totalPages = computeTotalPages(merged.notes, merged.notesPerPage);
  const desiredPage = partial.currentPage ?? merged.currentPage ?? state.currentPage;
  merged.currentPage = clampPage(desiredPage, totalPages);

  merged.selectedNoteId =
    typeof merged.selectedNoteId === "string" ? merged.selectedNoteId : null;
  merged.compactView =
    typeof partial.compactView === "boolean" ? partial.compactView : state.compactView;
  merged.useChromeSync = supportsChromeSync
    ? typeof partial.useChromeSync === "boolean"
      ? partial.useChromeSync
      : state.useChromeSync
    : false;

  activeChromeStorage = merged.useChromeSync && supportsChromeSync ? "sync" : "local";
  if (!supportsChromeSync) {
    merged.useChromeSync = false;
  }

  merged.activeCategory =
    typeof partial.activeCategory === "string"
      ? partial.activeCategory.trim() || null
      : merged.activeCategory ?? null;

  merged.viewMode =
    partial.viewMode === "desktop" || partial.viewMode === "list"
      ? partial.viewMode
      : merged.viewMode ?? defaultState.viewMode;

  state = merged;
  return state;
}

export function resetState(initial?: ChromnotesState): ChromnotesState {
  const normalized = normalizeState(initial);
  state = {
    ...defaultState,
    ...normalized,
    notes: [...normalized.notes],
    categoryIndex: buildCategoryIndex(normalized.notes),
    notesPerPage: normalizeNotesPerPage(initial?.notesPerPage ?? defaultState.notesPerPage),
    currentPage: clampPage(
      initial?.currentPage ?? defaultState.currentPage,
      computeTotalPages(normalized.notes, normalizeNotesPerPage(initial?.notesPerPage))
    ),
    compactView: Boolean(initial?.compactView ?? defaultState.compactView),
    useChromeSync:
      supportsChromeSync && typeof initial?.useChromeSync === "boolean"
        ? initial.useChromeSync
        : false,
    activeCategory:
      typeof initial?.activeCategory === "string" && initial.activeCategory.trim().length
        ? initial.activeCategory.trim()
        : null,
    viewMode:
      initial?.viewMode === "desktop" || initial?.viewMode === "list"
        ? initial.viewMode
        : defaultState.viewMode
  };
  activeChromeStorage = state.useChromeSync && supportsChromeSync ? "sync" : "local";

  return state;
}

export async function loadState(): Promise<ChromnotesState> {
  let payload: Partial<ChromnotesState> | null = null;
  let modeUsed: "sync" | "local" | null = null;

  if (supportsChromeSync) {
    const syncPayload = await readFromChromeStorage("sync");
    if (syncPayload && Object.keys(syncPayload).length) {
      payload = syncPayload;
      modeUsed = "sync";
    }
  }

  if (!payload && supportsChromeLocal) {
    const localPayload = await readFromChromeStorage("local");
    if (localPayload && Object.keys(localPayload).length) {
      payload = localPayload;
      modeUsed = "local";
    }
  }

  if (payload && modeUsed) {
    payload.useChromeSync =
      supportsChromeSync && typeof payload.useChromeSync === "boolean"
        ? payload.useChromeSync
        : modeUsed === "sync";
    const normalized = normalizeState(payload);
    normalized.useChromeSync = payload.useChromeSync ?? (modeUsed === "sync" && supportsChromeSync);
    state = {
      ...state,
      ...normalized,
      notes: [...normalized.notes],
      categoryIndex: buildCategoryIndex(normalized.notes)
    };
    activeChromeStorage = normalized.useChromeSync && supportsChromeSync ? "sync" : "local";
    return state;
  }

  try {
    const raw = localStorage.getItem(STORAGE_FALLBACK_KEY);
    if (!raw) {
      return resetState();
    }
    const parsed = JSON.parse(raw) as Partial<ChromnotesState>;
    const normalized = normalizeState(parsed);
    normalized.useChromeSync = supportsChromeSync && Boolean(parsed.useChromeSync);
    state = {
      ...state,
      ...normalized,
      notes: [...normalized.notes],
      categoryIndex: buildCategoryIndex(normalized.notes)
    };
    activeChromeStorage = normalized.useChromeSync && supportsChromeSync ? "sync" : "local";
    return state;
  } catch (error) {
    console.warn("Chromnotes: failed to parse local storage payload.", error);
    return resetState();
  }
}

export async function persistState(
  partial: Partial<ChromnotesState>
): Promise<ChromnotesState> {
  let next = updateState(partial);
  let preferredWritten = false;

  if (next.useChromeSync && supportsChromeSync) {
    preferredWritten = await writeToChromeStorage("sync", next);
    if (preferredWritten) {
      activeChromeStorage = "sync";
      if (supportsChromeLocal) {
        await writeToChromeStorage("local", next);
      }
    } else {
      console.warn("Chromnotes: falling back to local storage after sync write failure.");
      next = updateState({ useChromeSync: false });
    }
  }

  if (!preferredWritten) {
    await writeToChromeStorage("local", next);
    activeChromeStorage = "local";
  }

  localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(getState()));
  return getState();
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getTotalPages(): number {
  return computeTotalPages(state.notes, state.notesPerPage);
}

export function setCurrentPage(page: number): ChromnotesState {
  return updateState({ currentPage: page });
}

export function isChromeSyncAvailable(): boolean {
  return supportsChromeSync;
}
