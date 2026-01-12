import { categoryInput, modal, modalSaveButton, noteIdInput, titleInput } from "../dom";
import { getEditorData, getEditorValue, refreshEditorCache } from "../editor";
import { getState, persistState, generateId } from "../state";
import { Note } from "../types";
import { populateForm } from "../view";
import { primeHistory, queueHistorySnapshot } from "./history-controller";

const AUTO_SAVE_DELAY_MS = 60_000;
const AUTO_SAVE_GLOW_DURATION_MS = 2_000;
const AUTO_SAVE_GLOW_CLASS = "modal-save-button--autosaved";

let autoSaveTimer: number | null = null;
let autoSaveGlowTimer: number | null = null;
let refreshNotesList: (() => void) | null = null;

type SaveReason = "manual" | "auto";

export function registerNotesListRefresher(callback: () => void): void {
  refreshNotesList = callback;
}

export function resetAutoSaveState(): void {
  if (autoSaveTimer !== null) {
    window.clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function triggerAutoSaveGlow(): void {
  if (autoSaveGlowTimer !== null) {
    window.clearTimeout(autoSaveGlowTimer);
    autoSaveGlowTimer = null;
  }
  modalSaveButton.classList.remove(AUTO_SAVE_GLOW_CLASS);
  void modalSaveButton.offsetWidth;
  modalSaveButton.classList.add(AUTO_SAVE_GLOW_CLASS);
  autoSaveGlowTimer = window.setTimeout(() => {
    modalSaveButton.classList.remove(AUTO_SAVE_GLOW_CLASS);
    autoSaveGlowTimer = null;
  }, AUTO_SAVE_GLOW_DURATION_MS);
}

export function getFormSnapshot(): {
  id: string | null;
  title: string;
  content: string;
  contentRaw: ReturnType<typeof getEditorData>;
  category: string;
} {
  return {
    id: noteIdInput.value || null,
    title: titleInput.value.trim(),
    content: getEditorValue(),
    contentRaw: getEditorData(),
    category: categoryInput.value.trim()
  };
}

function isEditingExistingNote(): boolean {
  return modal.dataset.mode === "edit" && Boolean(noteIdInput.value);
}

function hasFormChanges(): boolean {
  const snapshot = getFormSnapshot();
  if (!snapshot.id) {
    return false;
  }
  const existing = getState().notes.find((note) => note.id === snapshot.id);
  if (!existing) {
    return false;
  }
  return (
    existing.title !== snapshot.title ||
    existing.content !== snapshot.content ||
    existing.category !== snapshot.category ||
    JSON.stringify(existing.contentRaw ?? null) !== JSON.stringify(snapshot.contentRaw ?? null)
  );
}

function scheduleAutoSave(): void {
  resetAutoSaveState();
  autoSaveTimer = window.setTimeout(() => {
    void triggerAutoSave();
  }, AUTO_SAVE_DELAY_MS);
}

async function triggerAutoSave(): Promise<void> {
  autoSaveTimer = null;
  if (!isEditingExistingNote()) {
    return;
  }
  if (!hasFormChanges()) {
    return;
  }
  await saveCurrentNote("auto");
}

async function saveCurrentNote(reason: SaveReason): Promise<boolean> {
  await refreshEditorCache();
  const snapshot = getFormSnapshot();
  if (reason === "auto" && !snapshot.id) {
    return false;
  }

  const state = getState();
  const isNewNote = !snapshot.id;
  const now = Date.now();
  const note: Note = {
    id: snapshot.id ?? generateId(),
    title: snapshot.title,
    content: snapshot.content,
    contentRaw: snapshot.contentRaw,
    category: snapshot.category,
    createdAt: snapshot.id
      ? (state.notes.find((existing) => existing.id === snapshot.id)?.createdAt ?? now)
      : now,
    updatedAt: now
  };

  const nextNotes = isNewNote
    ? [...state.notes, note]
    : state.notes.map((existing) => (existing.id === note.id ? note : existing));

  const selected = snapshot.id
    ? (nextNotes.find((candidate) => candidate.id === snapshot.id) ?? null)
    : (nextNotes[nextNotes.length - 1] ?? null);

  await persistState({
    notes: nextNotes,
    selectedNoteId: selected?.id ?? null,
    currentPage: 1
  });

  refreshNotesList?.();
  if (selected) {
    populateForm(selected);
    modal.dataset.mode = "edit";
  } else {
    populateForm(null);
    modal.dataset.mode = "create";
  }

  resetAutoSaveState();
  if (reason === "auto") {
    triggerAutoSaveGlow();
  } else if (autoSaveGlowTimer !== null) {
    window.clearTimeout(autoSaveGlowTimer);
    autoSaveGlowTimer = null;
    modalSaveButton.classList.remove(AUTO_SAVE_GLOW_CLASS);
  }
  if (selected) {
    const snapshot = getFormSnapshot();
    primeHistory(selected.id, () => ({
      title: snapshot.title,
      category: snapshot.category,
      content: snapshot.content,
      contentRaw: snapshot.contentRaw
    }));
  }
  return true;
}

export async function handleFormSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  await saveCurrentNote("manual");
}

export function handleFormFieldChange(): void {
  if (!isEditingExistingNote()) {
    resetAutoSaveState();
    return;
  }
  if (!hasFormChanges()) {
    resetAutoSaveState();
    return;
  }
  scheduleAutoSave();
  queueHistorySnapshot(noteIdInput.value || null, () => {
    const snapshot = getFormSnapshot();
    return {
      title: snapshot.title,
      category: snapshot.category,
      content: snapshot.content,
      contentRaw: snapshot.contentRaw
    };
  });
}
