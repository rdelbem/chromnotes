import { STORAGE_FALLBACK_KEY, type ChromnotesState, type Note } from "../types";

type ChromeSetCallback = () => void;
type ChromeGetCallback = (items: unknown) => void;

type ChromeStorageAreaMock = {
  get: jest.Mock<void, [string[] | Record<string, unknown>, ChromeGetCallback]>;
  set: jest.Mock<void, [Record<string, unknown>, ChromeSetCallback | undefined]>;
};

type ChromeMock = {
  storage: {
    sync: ChromeStorageAreaMock;
    local: ChromeStorageAreaMock;
  };
  runtime: {
    lastError: null | { message: string };
  };
};

function createNote(overrides: Partial<Note> = {}): Note {
  const timestamp = overrides.updatedAt ?? Date.now();
  return {
    id: overrides.id ?? `note-${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title ?? "Title",
    content: overrides.content ?? "Body",
    contentRaw:
      overrides.contentRaw ??
      ({
        blocks: [{ type: "paragraph", data: { text: "Body" } }]
      } as Note["contentRaw"]),
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: timestamp,
    category: overrides.category ?? "General"
  };
}

function installChromeMock(): ChromeMock {
  const sync: ChromeStorageAreaMock = {
    get: jest.fn(),
    set: jest.fn()
  } as unknown as ChromeStorageAreaMock;

  const local: ChromeStorageAreaMock = {
    get: jest.fn(),
    set: jest.fn()
  } as unknown as ChromeStorageAreaMock;

  const chromeMock: ChromeMock = {
    storage: { sync, local },
    runtime: { lastError: null }
  };

  (globalThis as typeof globalThis & { chrome?: ChromeMock }).chrome = chromeMock;
  return chromeMock;
}

async function importStateModule() {
  return import("../state");
}

describe("state chrome storage integration", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    delete (globalThis as { chrome?: ChromeMock }).chrome;
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test("loadState prefers chrome sync payload when available", async () => {
    const chromeMock = installChromeMock();
    const note = createNote();
    chromeMock.storage.sync.get.mockImplementation((_keys, callback) => {
      chromeMock.runtime.lastError = null;
      callback({
        notes: [note],
        selectedNoteId: note.id,
        theme: "paper",
        useChromeSync: true,
        categoryIndex: { General: [note.id] }
      });
    });
    chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });
    chromeMock.storage.sync.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = null;
      callback?.();
    });
    chromeMock.storage.local.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = null;
      callback?.();
    });

    const { loadState, getState } = await importStateModule();
    const state = await loadState();

    expect(chromeMock.storage.sync.get).toHaveBeenCalled();
    expect(state.useChromeSync).toBe(true);
    expect(state.selectedNoteId).toBe(note.id);
    expect(getState().theme).toBe("paper");
  });

  test("persistState mirrors sync writes into local storage", async () => {
    const chromeMock = installChromeMock();
    chromeMock.storage.sync.get.mockImplementation((_keys, callback) => {
      chromeMock.runtime.lastError = null;
      callback({});
    });
    chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });
    chromeMock.storage.sync.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = null;
      callback?.();
    });
    chromeMock.storage.local.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = null;
      callback?.();
    });

    const { persistState, getState } = await importStateModule();
    const note = createNote();
    await persistState({
      useChromeSync: true,
      notes: [note],
      selectedNoteId: note.id
    });

    expect(chromeMock.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(chromeMock.storage.local.set).toHaveBeenCalledTimes(1);
    expect(getState().useChromeSync).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_FALLBACK_KEY) ?? "{}").notes).toHaveLength(1);
  });

  test("persistState falls back to local storage when sync write fails", async () => {
    const chromeMock = installChromeMock();
    chromeMock.storage.sync.get.mockImplementation((_keys, callback) => {
      chromeMock.runtime.lastError = null;
      callback({});
    });
    chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });
    chromeMock.storage.sync.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = { message: "sync failure" };
      callback?.();
    });
    chromeMock.storage.local.set.mockImplementation((_payload, callback) => {
      chromeMock.runtime.lastError = null;
      callback?.();
    });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { persistState, getState } = await importStateModule();
    await persistState({
      useChromeSync: true,
      notes: [],
      selectedNoteId: null
    });

    expect(chromeMock.storage.sync.set).toHaveBeenCalled();
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
    expect(getState().useChromeSync).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "Chromnotes: falling back to local storage after sync write failure."
    );
    warnSpy.mockRestore();
  });

  test("loadState warns when chrome sync get fails", async () => {
    const chromeMock = installChromeMock();
    chromeMock.storage.sync.get.mockImplementation((_keys, callback) => {
      chromeMock.runtime.lastError = { message: "sync read failure" };
      callback({});
    });
    chromeMock.storage.local.get.mockImplementation((_keys, callback) => {
      chromeMock.runtime.lastError = null;
      callback({});
    });

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const fallbackSnapshot: ChromnotesState = {
      notes: [createNote({ id: "fallback" })],
      categoryIndex: { General: ["fallback"] },
      theme: "dark",
      selectedNoteId: "fallback",
      currentPage: 1,
      notesPerPage: 10,
      compactView: false,
      useChromeSync: false,
      activeCategory: null,
      viewMode: "list"
    };
    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(fallbackSnapshot));

    const { loadState, getState } = await importStateModule();
    const state = await loadState();

    expect(chromeMock.storage.sync.get).toHaveBeenCalled();
    expect(state.selectedNoteId).toBe("fallback");
    expect(getState().notes).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Chromnotes: chrome.storage.sync.get failed.",
      expect.any(Object)
    );
    warnSpy.mockRestore();
  });
});
