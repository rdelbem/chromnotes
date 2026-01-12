import { importNotesStatus, noteIdInput, searchInput, titleInput, categoryInput } from "./dom";
import { getEditorValue, initEditor, refreshEditorCache, setEditorContent } from "./editor";
import { applyModalSize, closeModal, openModal } from "./modal";
import { getState, getTotalPages, loadState, persistState, updateState } from "./state";
import { Note, STORAGE_FALLBACK_KEY } from "./types";
import { populateForm, renderNotesList, restoreFormToState } from "./view";
import { bindEventListeners } from "./event-bindings";
import {
  applyCompactView,
  applySyncPreference,
  applyTheme,
  applyViewMode,
  closeSettingsPanel,
  refreshSettingsControls,
  registerSettingsNotesRefresh,
  applyAppearanceTheme
} from "./controllers/settings-controller";
import { registerNotesListRefresher, resetAutoSaveState } from "./controllers/autosave-controller";
import { getFormSnapshot } from "./controllers/autosave-controller";
import { primeHistory, redoNoteChange, undoNoteChange } from "./controllers/history-controller";
import { parseNotesFromText, persistImportedNotes } from "./services/data-transfer";
import { initAiController } from "./controllers/ai-controller";

let importStatusTimer: number | null = null;

function refreshNotesList(filter = searchInput.value): void {
  renderNotesList(filter, handleNoteSelection);
}

registerNotesListRefresher(() => refreshNotesList());
registerSettingsNotesRefresh(() => refreshNotesList());

function handleNoteSelection(note: Note): void {
  void persistState({ selectedNoteId: note.id });
  openModal("edit");
  resetAutoSaveState();
  primeHistory(note.id, () => {
    const snapshot = getFormSnapshot();
    return {
      title: snapshot.title,
      category: snapshot.category,
      content: snapshot.content,
      contentRaw: snapshot.contentRaw
    };
  });
}

async function goToPage(page: number): Promise<void> {
  const current = getState();
  const totalPages = getTotalPages();
  const target = Math.min(Math.max(page, 1), totalPages);
  if (target === current.currentPage) {
    return;
  }

  await persistState({ currentPage: target });
  refreshNotesList();
}

async function handleNewNote(): Promise<void> {
  populateForm(null);
  await persistState({ selectedNoteId: null, currentPage: 1 });
  closeSettingsPanel();
  openModal("create");
  resetAutoSaveState();
}

async function handleDeleteNote(): Promise<void> {
  const id = noteIdInput.value;
  if (!id) return;

  const state = getState();
  const nextNotes = state.notes.filter((note) => note.id !== id);
  const totalPages = Math.max(1, Math.ceil(nextNotes.length / state.notesPerPage));
  const nextPage = Math.min(state.currentPage, totalPages);
  await persistState({
    notes: nextNotes,
    selectedNoteId: null,
    currentPage: nextPage
  });
  refreshNotesList();
  populateForm(null);
  if (getState().viewMode === "list") {
    closeModal();
  }
  resetAutoSaveState();
}

function handleSearchInput(value: string): void {
  updateState({ currentPage: 1 });
  renderNotesList(value, handleNoteSelection);
}

function handleModalDismiss(): void {
  restoreFormToState();
  if (getState().viewMode === "list") {
    closeModal();
  }
  resetAutoSaveState();
}

async function handleImportNotes(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    return;
  }

  if (importStatusTimer !== null) {
    window.clearTimeout(importStatusTimer);
    importStatusTimer = null;
  }

  importNotesStatus.textContent = "Importing…";
  try {
    const fileContents = await file.text();
    const notes = parseNotesFromText(fileContents);
    importNotesStatus.textContent = `Imported ${notes.length} note${notes.length === 1 ? "" : "s"}.`;
    await persistImportedNotes(notes);
    refreshNotesList();
    restoreFormToState();
  } catch (error) {
    console.error("Chromnotes: failed to import notes.", error);
    importNotesStatus.textContent = "Import failed. Please check the file.";
  } finally {
    input.value = "";
    importStatusTimer = window.setTimeout(() => {
      importNotesStatus.textContent = "";
      importStatusTimer = null;
    }, 5000);
  }
}

function bindGlobalStorageListener(): void {
  window.addEventListener("storage", async (event) => {
    if (event.key !== STORAGE_FALLBACK_KEY) return;
    await loadState();
    applyTheme(getState().theme);
    await applyAppearanceTheme(getState().appearanceTheme, { persist: false });
    applyCompactView(getState().compactView, { refresh: false, syncState: false });
    await applyViewMode(getState().viewMode, { persist: false });
    refreshNotesList();
    restoreFormToState();
    refreshSettingsControls();
    resetAutoSaveState();
  });
}

type AiMergeDetail = {
  noteId?: string;
};

function bindAiMergeListener(): void {
  window.addEventListener("chromnotes:ai-merge-complete", (event) => {
    refreshNotesList();
    const detail = (event as CustomEvent<AiMergeDetail>).detail;
    if (detail?.noteId) {
      const merged = getState().notes.find((note) => note.id === detail.noteId);
      if (merged) {
        populateForm(merged);
        openModal("edit");
        resetAutoSaveState();
      }
    }
  });
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

async function handleCopyNote(): Promise<void> {
  await refreshEditorCache();
  const content = getEditorValue().trim();
  const title = titleInput.value.trim();
  const textToCopy = [title, content].filter(Boolean).join("\n\n");
  if (!textToCopy) {
    return;
  }
  try {
    await copyTextToClipboard(textToCopy);
  } catch (error) {
    console.error("Chromnotes: failed to copy note content.", error);
  }
}

function applySnapshotToForm(snapshot: {
  title: string;
  category: string;
  content: string;
  contentRaw: Note["contentRaw"];
}): void {
  titleInput.value = snapshot.title;
  categoryInput.value = snapshot.category;
  setEditorContent(snapshot.contentRaw, snapshot.content);
}

async function handleUndo(): Promise<void> {
  await refreshEditorCache();
  const noteId = noteIdInput.value || null;
  if (!noteId) return;
  const snapshot = getFormSnapshot();
  const previous = undoNoteChange(noteId, {
    title: snapshot.title,
    category: snapshot.category,
    content: snapshot.content,
    contentRaw: snapshot.contentRaw
  });
  if (!previous) return;
  applySnapshotToForm(previous);
}

async function handleRedo(): Promise<void> {
  await refreshEditorCache();
  const noteId = noteIdInput.value || null;
  if (!noteId) return;
  const snapshot = getFormSnapshot();
  const next = redoNoteChange(noteId, {
    title: snapshot.title,
    category: snapshot.category,
    content: snapshot.content,
    contentRaw: snapshot.contentRaw
  });
  if (!next) return;
  applySnapshotToForm(next);
}

function setupEventBindings(): void {
  bindEventListeners({
    onNewNote: () => {
      void handleNewNote();
    },
    onDeleteNote: () => {
      void handleDeleteNote();
    },
    onModalDismiss: handleModalDismiss,
    onImportNotes: (event) => {
      void handleImportNotes(event);
    },
    onSearchInput: handleSearchInput,
    onGoToPreviousPage: () => {
      void goToPage(getState().currentPage - 1);
    },
    onGoToNextPage: () => {
      void goToPage(getState().currentPage + 1);
    },
    onCopyNote: () => {
      void handleCopyNote();
    },
    onUndo: () => {
      void handleUndo();
    },
    onRedo: () => {
      void handleRedo();
    }
  });
}

export async function bootstrap(): Promise<void> {
  closeModal();
  applyModalSize();
  closeSettingsPanel();
  initEditor();
  initAiController();

  const initialState = await loadState();
  await applySyncPreference(initialState.useChromeSync, {
    persist: false
  });
  applyTheme(initialState.theme);
  await applyAppearanceTheme(initialState.appearanceTheme, { persist: false });
  applyCompactView(initialState.compactView, { refresh: false, syncState: false });
  refreshNotesList();

  if (initialState.selectedNoteId) {
    const current = initialState.notes.find((note) => note.id === initialState.selectedNoteId);
    if (current) {
      populateForm(current);
      primeHistory(current.id, () => {
        const snapshot = getFormSnapshot();
        return {
          title: snapshot.title,
          category: snapshot.category,
          content: snapshot.content,
          contentRaw: snapshot.contentRaw
        };
      });
    } else {
      populateForm(null);
      await persistState({ selectedNoteId: null });
    }
  } else {
    populateForm(null);
  }

  await applyViewMode(initialState.viewMode, { persist: false });
  refreshSettingsControls();

  bindGlobalStorageListener();
  bindAiMergeListener();
  setupEventBindings();
}
