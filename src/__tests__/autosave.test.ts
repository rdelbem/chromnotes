import { bootstrapApp, loadAppMarkup, mockEditor } from "../test/test-helpers";
import { STORAGE_FALLBACK_KEY, defaultState, type Note } from "../types";

function buildSnapshot(note?: Note) {
  if (!note) {
    return {
      ...defaultState,
      notes: [],
      categoryIndex: {}
    };
  }

  return {
    ...defaultState,
    notes: [note],
    categoryIndex: { [note.category]: [note.id] },
    selectedNoteId: note.id
  };
}

function createNote(overrides: Partial<Note> = {}): Note {
  const baseTimestamp = Date.now();
  return {
    id: overrides.id ?? "note-1",
    title: overrides.title ?? "Original",
    content: overrides.content ?? "Body",
    contentRaw:
      overrides.contentRaw ??
      ({
        blocks: [{ type: "paragraph", data: { text: "Body" } }]
      } as Note["contentRaw"]),
    createdAt: overrides.createdAt ?? baseTimestamp,
    updatedAt: overrides.updatedAt ?? baseTimestamp,
    category: overrides.category ?? "General"
  };
}

describe("autosave workflow", () => {
  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    loadAppMarkup();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("auto saves an edited note after inactivity", async () => {
    jest.useFakeTimers();
    const note = createNote();
    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(buildSnapshot(note)));
    mockEditor();
    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    expect(noteCard).not.toBeNull();
    noteCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushMicrotasks();

    const modal = document.getElementById("noteModal") as HTMLDivElement;
    expect(modal.dataset.mode).toBe("edit");
    const noteIdInput = document.getElementById("noteId") as HTMLInputElement;
    expect(noteIdInput.value).toBe(note.id);

    const titleInput = document.getElementById("noteTitle") as HTMLInputElement;
    titleInput.value = "Updated title";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    const modalSaveButton = document.getElementById("modalSaveButton") as HTMLButtonElement;
    const addSpy = jest.spyOn(modalSaveButton.classList, "add");
    const removeSpy = jest.spyOn(modalSaveButton.classList, "remove");

    expect(jest.getTimerCount()).toBeGreaterThan(0);

    await jest.advanceTimersByTimeAsync(60_000);
    await flushMicrotasks();

    expect(addSpy).toHaveBeenCalledWith("modal-save-button--autosaved");

    const stateModule = await import("../state");
    const current = stateModule.getState();
    expect(current.notes[0]?.title).toBe("Updated title");
    expect(current.selectedNoteId).toBe(note.id);

    await jest.advanceTimersByTimeAsync(2_000);
    await flushMicrotasks();
    expect(removeSpy).toHaveBeenCalledWith("modal-save-button--autosaved");
  });

  test("does not auto save drafts for new notes without an id", async () => {
    jest.useFakeTimers();
    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(buildSnapshot()));
    mockEditor();
    await bootstrapApp();

    const newNoteButton = document.getElementById("newNoteButton") as HTMLButtonElement;
    newNoteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushMicrotasks();

    const modal = document.getElementById("noteModal") as HTMLDivElement;
    expect(modal.dataset.mode).toBe("create");

    const titleInput = document.getElementById("noteTitle") as HTMLInputElement;
    titleInput.value = "Draft title";
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    await jest.advanceTimersByTimeAsync(60_000);
    await flushMicrotasks();

    const stateModule = await import("../state");
    const current = stateModule.getState();
    expect(current.notes.some((entry) => entry.title === "Draft title")).toBe(false);

    const modalSaveButton = document.getElementById("modalSaveButton") as HTMLButtonElement;
    expect(modalSaveButton.classList.contains("modal-save-button--autosaved")).toBe(false);
  });

  test("deletes a note and closes the modal in list view", async () => {
    const note = createNote();
    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(buildSnapshot(note)));
    mockEditor();
    await bootstrapApp();

    const noteCard = document.querySelector(".note-card") as HTMLLIElement;
    noteCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushMicrotasks();

    const deleteButton = document.getElementById("modalDeleteButton") as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(false);
    deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushMicrotasks();

    const stateModule = await import("../state");
    const current = stateModule.getState();
    expect(current.notes).toHaveLength(0);
    expect(current.selectedNoteId).toBeNull();

    const modalBackdrop = document.getElementById("modalBackdrop") as HTMLDivElement;
    expect(modalBackdrop.classList.contains("hidden")).toBe(true);
  });
});
