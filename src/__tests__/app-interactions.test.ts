import { bootstrapApp, loadAppMarkup, mockEditor } from "../test/test-helpers";
import { STORAGE_FALLBACK_KEY, defaultState, type ChromnotesState, type Note } from "../types";

function withSnapshot(partial: Partial<ChromnotesState>): void {
  const snapshot: ChromnotesState = {
    ...defaultState,
    ...partial,
    notes: partial.notes ?? defaultState.notes,
    categoryIndex: partial.categoryIndex ?? defaultState.categoryIndex,
    currentPage: partial.currentPage ?? defaultState.currentPage,
    notesPerPage: partial.notesPerPage ?? defaultState.notesPerPage
  };
  localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(snapshot));
}

function createNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: overrides.id ?? `note-${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title ?? "Sample",
    content: overrides.content ?? "Content",
    contentRaw:
      overrides.contentRaw ??
      ({
        blocks: [{ type: "paragraph", data: { text: "Content" } }]
      } as Note["contentRaw"]),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    category: overrides.category ?? "General"
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("app interactions", () => {
  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    loadAppMarkup();
    localStorage.clear();
    const globalWithChrome = globalThis as unknown as {
      chrome?: unknown;
    };
    globalWithChrome.chrome = {
      storage: {},
      runtime: { lastError: null }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("pagination clamps and only persists when page actually changes", async () => {
    const notes = [createNote({ id: "p1" }), createNote({ id: "p2" }), createNote({ id: "p3" })];
    withSnapshot({
      notes,
      currentPage: 1,
      notesPerPage: 1,
      categoryIndex: { General: notes.map((note) => note.id) }
    });
    mockEditor();
    const stateModule = await import("../state");
    const persistSpy = jest.spyOn(stateModule, "persistState");
    await bootstrapApp();

    const prevButton = document.getElementById("prevPageButton") as HTMLButtonElement;
    prevButton.disabled = false;
    prevButton.removeAttribute("disabled");
    persistSpy.mockClear();
    prevButton.click();
    await flushAsync();
    await flushAsync();
    expect(persistSpy).not.toHaveBeenCalled();

    const nextButton = document.getElementById("nextPageButton") as HTMLButtonElement;
    persistSpy.mockClear();
    nextButton.click();
    await flushAsync();
    await flushAsync();
    expect(persistSpy).toHaveBeenCalled();
    expect(stateModule.getState().currentPage).toBe(2);

    persistSpy.mockRestore();
  });

  test("theme toggle switches between light and dark", async () => {
    withSnapshot({ theme: "light" });
    mockEditor();
    await bootstrapApp();

    const { getState } = await import("../state");
    expect(getState().theme).toBe("light");

    const themeToggle = document.getElementById("themeToggle") as HTMLInputElement;
    themeToggle.checked = true;
    themeToggle.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsync();
    expect(getState().theme).toBe("dark");
    expect(document.body.dataset.theme).toBe("dark");

    themeToggle.checked = false;
    themeToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();
    expect(getState().theme).toBe("light");
  });

  test("layout change to desktop opens modal and maximize button respects desktop mode", async () => {
    const note = createNote();
    withSnapshot({ notes: [note], selectedNoteId: note.id, categoryIndex: { General: [note.id] } });
    mockEditor();
    await bootstrapApp();

    const desktopRadio = document.querySelector(
      'input[name="layoutChoice"][value="desktop"]'
    ) as HTMLInputElement;
    desktopRadio.checked = true;
    desktopRadio.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();

    const bodyDatasetLayout = document.body.dataset.layout;
    expect(bodyDatasetLayout).toBe("desktop");
    const modal = document.getElementById("noteModal") as HTMLDivElement;
    expect(modal.classList.contains("modal--maximized")).toBe(true);

    const modalMaximizeButton = document.getElementById("modalMaximizeButton") as HTMLButtonElement;
    modalMaximizeButton.click();
    await flushAsync();
    expect(modal.classList.contains("modal--maximized")).toBe(true);

    const listRadio = document.querySelector(
      'input[name="layoutChoice"][value="list"]'
    ) as HTMLInputElement;
    listRadio.checked = true;
    listRadio.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();
    expect(document.body.dataset.layout).toBe("list");
  });

  test("category filter persists selection and resets pagination", async () => {
    const notes = [
      createNote({ id: "one", category: "Work" }),
      createNote({ id: "two", category: "Personal" }),
      createNote({ id: "three", category: "Work" })
    ];
    withSnapshot({
      notes,
      notesPerPage: 1,
      currentPage: 2,
      categoryIndex: { Work: ["one", "three"], Personal: ["two"] }
    });
    mockEditor();
    await bootstrapApp();

    const filter = document.getElementById("categoryFilter") as HTMLSelectElement;
    filter.value = "Work";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();

    const { getState } = await import("../state");
    expect(getState().activeCategory).toBe("Work");
    expect(getState().currentPage).toBe(1);
  });

  test("search input resets pagination", async () => {
    const notes = [createNote(), createNote(), createNote()];
    withSnapshot({
      notes,
      notesPerPage: 1,
      currentPage: 3,
      categoryIndex: { General: notes.map((note) => note.id) }
    });
    mockEditor();
    await bootstrapApp();

    const searchField = document.getElementById("searchInput") as HTMLInputElement;
    searchField.value = "chrom";
    searchField.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();

    const { getState } = await import("../state");
    expect(getState().currentPage).toBe(1);
  });

  test("sync toggle reverts when chrome sync is unavailable", async () => {
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const syncToggle = document.getElementById("syncToggle") as HTMLInputElement;
    syncToggle.checked = true;
    syncToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();

    expect(syncToggle.checked).toBe(false);
    const { getState } = await import("../state");
    expect(getState().useChromeSync).toBe(false);
  });

  test("sync toggle persists to chrome storage when sync is available", async () => {
    const chromeMock = {
      storage: {
        sync: {
          get: jest.fn((_keys, callback: (items: unknown) => void) => {
            callback({});
          }),
          set: jest.fn((payload: unknown, callback?: () => void) => {
            callback?.();
          })
        },
        local: {
          get: jest.fn((_keys, callback: (items: unknown) => void) => {
            callback({});
          }),
          set: jest.fn((payload: unknown, callback?: () => void) => {
            callback?.();
          })
        }
      },
      runtime: { lastError: null }
    };
    (globalThis as unknown as { chrome?: unknown }).chrome = chromeMock;

    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const syncToggle = document.getElementById("syncToggle") as HTMLInputElement;
    syncToggle.checked = true;
    syncToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();
    await flushAsync();

    expect(chromeMock.storage.sync.set).toHaveBeenCalled();
    expect(chromeMock.storage.local.set).toHaveBeenCalled();

    const { getState } = await import("../state");
    expect(getState().useChromeSync).toBe(true);
  });

  test("modal cancel closes the editor when in list view", async () => {
    const note = createNote();
    withSnapshot({
      notes: [note],
      selectedNoteId: note.id,
      categoryIndex: { General: [note.id] }
    });
    mockEditor();
    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsync();

    const modalBackdrop = document.getElementById("modalBackdrop") as HTMLDivElement;
    expect(modalBackdrop.classList.contains("hidden")).toBe(false);

    const cancelButton = document.getElementById("modalCancelButton") as HTMLButtonElement;
    cancelButton.click();
    await flushAsync();

    expect(modalBackdrop.classList.contains("hidden")).toBe(true);
    expect(document.body.classList.contains("modal-open")).toBe(false);
  });

  test("settings button toggles the panel closed when already open", async () => {
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const settingsButton = document.getElementById("settingsButton") as HTMLButtonElement;
    const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;

    settingsButton.click();
    await flushAsync();
    expect(settingsPanel.classList.contains("hidden")).toBe(false);

    settingsButton.click();
    await flushAsync();
    expect(settingsPanel.classList.contains("hidden")).toBe(true);
  });

  test("submitting the note form saves the current note", async () => {
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const newNoteButton = document.getElementById("newNoteButton") as HTMLButtonElement;
    newNoteButton.click();
    await flushAsync();

    const titleInput = document.getElementById("noteTitle") as HTMLInputElement;
    titleInput.value = "Manual save note";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    const form = document.getElementById("noteForm") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsync();
    await flushAsync();

    const { getState } = await import("../state");
    expect(getState().notes.some((note) => note.title === "Manual save note")).toBe(true);
  });

  test("settings panel reacts to overlay and escape key", async () => {
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const settingsButton = document.getElementById("settingsButton") as HTMLButtonElement;
    settingsButton.click();
    await flushAsync();

    const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;
    expect(settingsPanel.classList.contains("hidden")).toBe(false);

    const overlay = document.getElementById("settingsOverlay") as HTMLDivElement;
    overlay.click();
    await flushAsync();
    expect(settingsPanel.classList.contains("hidden")).toBe(true);

    settingsButton.click();
    await flushAsync();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushAsync();

    expect(settingsPanel.classList.contains("hidden")).toBe(true);
  });

  test("storage events refresh state and UI", async () => {
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const updatedNote = createNote({ id: "updated", title: "From storage" });
    withSnapshot({
      notes: [updatedNote],
      selectedNoteId: updatedNote.id,
      categoryIndex: { General: [updatedNote.id] },
      theme: "light",
      compactView: true,
      viewMode: "list"
    });

    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_FALLBACK_KEY }));
    await flushAsync();

    const { getState } = await import("../state");
    expect(getState().notes.some((note) => note.id === "updated")).toBe(true);
    expect(document.body.dataset.theme).toBe("light");
    expect(document.body.classList.contains("compact-list")).toBe(true);
  });

  test("import failure surfaces error message and clears input value", async () => {
    jest.useFakeTimers();
    withSnapshot({});
    mockEditor();
    await bootstrapApp();

    const importInput = document.getElementById("importNotesInput") as HTMLInputElement;
    const status = document.getElementById("importNotesStatus") as HTMLParagraphElement;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const malformedFile = {
      text: () => Promise.resolve("not valid json")
    } as unknown as File;
    Object.defineProperty(importInput, "files", {
      value: [malformedFile],
      configurable: true
    });

    importInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flushAsync();
    expect(status.textContent).toContain("Import failed");
    expect(importInput.value).toBe("");

    await jest.advanceTimersByTimeAsync(5000);
    await flushAsync();
    expect(status.textContent).toBe("");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("copy button writes title and content to clipboard", async () => {
    const note = createNote({
      id: "copy-note",
      title: "Copy Title",
      content: "Copy Content",
      contentRaw: {
        blocks: [{ type: "paragraph", data: { text: "Copy Content" } }]
      } as Note["contentRaw"]
    });
    withSnapshot({
      notes: [note],
      selectedNoteId: note.id,
      categoryIndex: { [note.category]: [note.id] }
    });
    mockEditor({
      saveResult: {
        blocks: [{ type: "paragraph", data: { text: "Copy Content" } }]
      }
    });
    const clipboardMock = { writeText: jest.fn(() => Promise.resolve()) };
    (navigator as unknown as { clipboard: typeof clipboardMock }).clipboard = clipboardMock;

    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.click();
    await flushAsync();

    const copyButton = document.getElementById("modalCopyButton") as HTMLButtonElement;
    copyButton.click();
    await flushAsync();
    await flushAsync();

    expect(clipboardMock.writeText).toHaveBeenCalledWith("Copy Title\n\nCopy Content");
  });

  test("copy button falls back to execCommand when clipboard API is unavailable", async () => {
    const note = createNote({
      id: "copy-fallback",
      title: "Fallback Title",
      content: "Fallback Content",
      contentRaw: {
        blocks: [{ type: "paragraph", data: { text: "Fallback Content" } }]
      } as Note["contentRaw"]
    });
    withSnapshot({
      notes: [note],
      selectedNoteId: note.id,
      categoryIndex: { [note.category]: [note.id] }
    });
    mockEditor({
      saveResult: {
        blocks: [{ type: "paragraph", data: { text: "Fallback Content" } }]
      }
    });

    const originalClipboard = (navigator as unknown as { clipboard?: unknown }).clipboard;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).clipboard;
    const originalExecCommand = (
      document as Document & {
        execCommand?: (commandId: string) => boolean;
      }
    ).execCommand;
    const execCommandMock = jest.fn(() => true);
    (document as Document & { execCommand?: typeof execCommandMock }).execCommand = execCommandMock;

    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.click();
    await flushAsync();

    const copyButton = document.getElementById("modalCopyButton") as HTMLButtonElement;
    copyButton.click();
    await flushAsync();
    await flushAsync();

    expect(execCommandMock).toHaveBeenCalledWith("copy");

    if (originalExecCommand) {
      (document as Document & { execCommand?: typeof originalExecCommand }).execCommand =
        originalExecCommand;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (document as any).execCommand;
    }
    if (originalClipboard) {
      (navigator as unknown as { clipboard?: unknown }).clipboard = originalClipboard;
    }
  });

  test("undo button restores previous snapshot", async () => {
    jest.useFakeTimers();
    const note = createNote({
      id: "undo-note",
      title: "Undo Title",
      content: "Undo Content",
      contentRaw: {
        blocks: [{ type: "paragraph", data: { text: "Undo Content" } }]
      } as Note["contentRaw"]
    });
    withSnapshot({
      notes: [note],
      selectedNoteId: note.id,
      categoryIndex: { [note.category]: [note.id] }
    });
    mockEditor();
    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.click();
    await flushAsync();

    const titleInput = document.getElementById("noteTitle") as HTMLInputElement;
    titleInput.value = "Updated Title";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    await jest.advanceTimersByTimeAsync(2000);
    await flushAsync();

    const undoButton = document.getElementById("modalUndoButton") as HTMLButtonElement;
    undoButton.click();
    await flushAsync();

    expect(titleInput.value).toBe("Undo Title");
  });

  test("redo button restores next snapshot", async () => {
    jest.useFakeTimers();
    const note = createNote({
      id: "redo-note",
      title: "Redo Title",
      content: "Redo Content",
      contentRaw: {
        blocks: [{ type: "paragraph", data: { text: "Redo Content" } }]
      } as Note["contentRaw"]
    });
    withSnapshot({
      notes: [note],
      selectedNoteId: note.id,
      categoryIndex: { [note.category]: [note.id] }
    });
    mockEditor();
    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.click();
    await flushAsync();

    const titleInput = document.getElementById("noteTitle") as HTMLInputElement;
    titleInput.value = "Updated Again";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    await jest.advanceTimersByTimeAsync(2000);
    await flushAsync();

    const undoButton = document.getElementById("modalUndoButton") as HTMLButtonElement;
    undoButton.click();
    await flushAsync();
    expect(titleInput.value).toBe("Redo Title");

    const redoButton = document.getElementById("modalRedoButton") as HTMLButtonElement;
    redoButton.click();
    await flushAsync();

    expect(titleInput.value).toBe("Updated Again");
  });
});
