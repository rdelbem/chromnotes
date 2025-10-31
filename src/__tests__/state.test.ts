import { STORAGE_FALLBACK_KEY, type ChromnotesState, type Note } from "../types";
import { formatDate, generateId, getState, loadState, persistState, resetState } from "../state";

const sampleNote = (): Note => ({
  id: generateId(),
  title: "Focus",
  content: "Ship Chromnotes",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  category: "General"
});

describe("state utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    resetState();
  });

  test("persistState stores notes and selection", async () => {
    const note = sampleNote();

    await persistState({
      notes: [note],
      selectedNoteId: note.id,
      theme: "light"
    });

    const current = getState();
    expect(current.notes).toHaveLength(1);
    expect(current.notes[0]).toMatchObject({
      id: note.id,
      title: note.title,
      category: note.category
    });
    expect(current.selectedNoteId).toBe(note.id);
    expect(current.theme).toBe("light");
    expect(current.currentPage).toBe(1);
    expect(current.notesPerPage).toBeGreaterThan(0);
    expect(current.compactView).toBe(false);
    expect(current.activeCategory).toBeNull();
    expect(current.viewMode).toBe("list");
    expect(current.categoryIndex).toEqual({ General: [note.id] });

    const stored = localStorage.getItem(STORAGE_FALLBACK_KEY);
    expect(stored).toBeTruthy();
    expect(stored).toContain(note.id);
  });

  test("loadState hydrates from localStorage", async () => {
    const note = sampleNote();
    const snapshot: ChromnotesState = {
      notes: [note],
      categoryIndex: { General: [note.id] },
      theme: "dark",
      selectedNoteId: note.id,
      currentPage: 2,
      notesPerPage: 10,
      compactView: true,
      useChromeSync: false,
      activeCategory: "General",
      viewMode: "desktop"
    };

    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(snapshot));

    const loaded = await loadState();
    expect(loaded.notes).toHaveLength(1);
    expect(loaded.selectedNoteId).toBe(note.id);
    expect(loaded.theme).toBe("dark");
    expect(loaded.notesPerPage).toBe(10);
    expect(loaded.currentPage).toBe(1);
    expect(loaded.compactView).toBe(true);
    expect(loaded.activeCategory).toBe("General");
    expect(loaded.viewMode).toBe("desktop");
    expect(loaded.categoryIndex.General).toEqual([note.id]);
  });

  test("generateId produces unique identifiers", () => {
    const ids = new Set(Array.from({ length: 8 }, () => generateId()));
    expect(ids.size).toBe(8);
  });

  test("formatDate returns a readable string", () => {
    const formatted = formatDate(Date.UTC(2024, 0, 15, 12, 30));
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });

  test("setCurrentPage clamps to available pages", async () => {
    const notes: Note[] = Array.from({ length: 5 }, () => sampleNote());
    await persistState({ notes, currentPage: 10 });
    const current = getState();
    expect(current.currentPage).toBe(1);
    expect(current.categoryIndex.General).toHaveLength(5);
  });

  test("category index updates when categories change", async () => {
    const note = sampleNote();
    await persistState({ notes: [note] });
    expect(getState().categoryIndex.General).toEqual([note.id]);

    const updated = { ...note, category: "Work", updatedAt: Date.now() };
    await persistState({ notes: [updated] });
    const current = getState();
    expect(current.categoryIndex.General).toBeUndefined();
    expect(current.categoryIndex.Work).toEqual([note.id]);
  });
});
