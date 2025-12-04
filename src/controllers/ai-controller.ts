import {
  aiApiKeyClearButton,
  aiApiKeyInput,
  aiApiKeySaveButton,
  aiApiKeyStatus,
  modalOrganizeButton,
  noteAssistantBanner,
  noteAssistantDismissButton,
  noteAssistantMergeButton,
  noteAssistantText
} from "../dom";
import { generateId, getState, persistState } from "../state";
import {
  AI_SETTINGS_STORAGE_KEY,
  clearAiApiKey,
  getAiApiKey,
  hasAiApiKey,
  setAiApiKey
} from "../services/ai-settings";
import { requestMergedNote, requestNoteOrganization } from "../services/ai";
import { Note } from "../types";

let isOrganizing = false;
let bannerNoteId: string | null = null;
let organizerResult: {
  noteId: string;
  summary: string;
  similarNoteIds: string[];
} | null = null;
let isMerging = false;

function setBanner(
  message: string | null,
  variant: "info" | "error" | "success" = "info",
  noteId: string | null = null
): void {
  if (!message) {
    noteAssistantBanner.hidden = true;
    noteAssistantBanner.removeAttribute("data-variant");
    noteAssistantText.textContent = "";
    bannerNoteId = null;
    updateMergeButtonState();
    return;
  }
  bannerNoteId = noteId;
  noteAssistantBanner.hidden = false;
  noteAssistantBanner.dataset.variant = variant;
  noteAssistantText.textContent = message;
  updateMergeButtonState();
}

function setKeyStatus(message: string, variant: "info" | "error" | "success" = "info"): void {
  aiApiKeyStatus.textContent = message;
  aiApiKeyStatus.dataset.variant = variant;
}

function getSelectedNote(): Note | null {
  const state = getState();
  if (!state.selectedNoteId) {
    return null;
  }
  return state.notes.find((note) => note.id === state.selectedNoteId) ?? null;
}

export function syncOrganizeButtonState(): void {
  const hasKey = hasAiApiKey();
  const hasSelection = Boolean(getState().selectedNoteId);
  modalOrganizeButton.disabled = !hasKey || !hasSelection || isOrganizing;
  if (!hasKey) {
    modalOrganizeButton.title = "Add an OpenAI API key in Settings to enable the AI brain.";
  } else if (!hasSelection) {
    modalOrganizeButton.title = "Select a note before running the AI brain.";
  } else if (isOrganizing) {
    modalOrganizeButton.title = "AI brain is looking for related notes…";
  } else {
    modalOrganizeButton.title = "Run AI brain";
  }
}

function updateMergeButtonState(): void {
  const canMerge = Boolean(
    organizerResult && organizerResult.similarNoteIds.length && !noteAssistantBanner.hidden
  );
  noteAssistantMergeButton.hidden = !canMerge;
  noteAssistantMergeButton.disabled = !canMerge || isMerging;
}

async function handleOrganizeClick(): Promise<void> {
  if (isOrganizing) {
    return;
  }
  const apiKey = getAiApiKey();
  if (!apiKey) {
    setKeyStatus("Add an OpenAI API key first.", "error");
    syncOrganizeButtonState();
    return;
  }
  const note = getSelectedNote();
  if (!note) {
    setBanner("Select a note before running AI brain.", "error");
    syncOrganizeButtonState();
    return;
  }

  isOrganizing = true;
  syncOrganizeButtonState();
  setBanner("AI brain is looking for related notes…", "info", note.id);

  try {
    const suggestion = await requestNoteOrganization({
      current: note,
      notes: getState().notes,
      apiKey
    });
    organizerResult = {
      noteId: note.id,
      summary: suggestion.summary,
      similarNoteIds: suggestion.similarNoteIds ?? []
    };
    setBanner(suggestion.summary, "success", note.id);
  } catch (error) {
    console.error("Chromnotes: AI brain lookup failed.", error);
    setBanner("AI brain could not reach ChatGPT. Please try again in a moment.", "error", note.id);
    organizerResult = null;
  } finally {
    isOrganizing = false;
    syncOrganizeButtonState();
  }
}

export function handleActiveNoteChange(noteId: string | null): void {
  if (noteId !== bannerNoteId) {
    setBanner(null);
  }
  if (organizerResult && organizerResult.noteId !== noteId) {
    organizerResult = null;
    updateMergeButtonState();
  }
  syncOrganizeButtonState();
}

function hydrateKeyField(): void {
  const currentKey = getAiApiKey();
  aiApiKeyInput.value = currentKey ?? "";
  if (currentKey) {
    setKeyStatus("API key is saved on this device.", "success");
  } else {
    setKeyStatus("Paste your OpenAI API key to enable the AI brain.", "info");
  }
}

function handleKeySave(): void {
  const value = aiApiKeyInput.value.trim();
  if (!value) {
    setKeyStatus("Enter a valid API key before saving.", "error");
    return;
  }
  setAiApiKey(value);
  setKeyStatus("API key saved.", "success");
  setBanner(null);
  syncOrganizeButtonState();
}

function handleKeyClear(): void {
  clearAiApiKey();
  aiApiKeyInput.value = "";
  setKeyStatus("API key removed.", "info");
  setBanner(null);
  syncOrganizeButtonState();
}

function dismissBanner(): void {
  setBanner(null);
  organizerResult = null;
  updateMergeButtonState();
}

async function handleMergeNotes(): Promise<void> {
  if (!organizerResult || !organizerResult.similarNoteIds.length) {
    return;
  }
  const apiKey = getAiApiKey();
  if (!apiKey) {
    setKeyStatus("Add an OpenAI API key first.", "error");
    return;
  }
  const state = getState();
  const noteIds = new Set<string>([organizerResult.noteId, ...organizerResult.similarNoteIds]);
  const notesToMerge = state.notes.filter((candidate) => noteIds.has(candidate.id));
  if (notesToMerge.length < 2) {
    setBanner("Need at least two notes to merge.", "error", organizerResult.noteId);
    return;
  }

  isMerging = true;
  updateMergeButtonState();
  setBanner("AI brain is merging the selected notes…", "info", organizerResult.noteId);

  try {
    const merged = await requestMergedNote({
      apiKey,
      notes: notesToMerge
    });

    const now = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: merged.title.trim() || "Merged note",
      content: merged.content,
      contentRaw: null,
      category: merged.category?.trim() ?? "",
      createdAt: now,
      updatedAt: now
    };

    const remaining = state.notes.filter((candidate) => !noteIds.has(candidate.id));
    const nextNotes = [...remaining, newNote];
    await persistState({ notes: nextNotes, selectedNoteId: newNote.id, currentPage: 1 });

    window.dispatchEvent(
      new CustomEvent("chromnotes:ai-merge-complete", {
        detail: { noteId: newNote.id }
      })
    );

    organizerResult = null;
    setBanner(merged.summary, "success", newNote.id);
  } catch (error) {
    console.error("Chromnotes: AI brain merge failed.", error);
    setBanner(
      "AI brain could not merge the notes. Please try again in a moment.",
      "error",
      organizerResult?.noteId ?? null
    );
  } finally {
    isMerging = false;
    updateMergeButtonState();
  }
}

function registerStorageListener(): void {
  window.addEventListener("storage", (event) => {
    if (event.key !== AI_SETTINGS_STORAGE_KEY) {
      return;
    }
    hydrateKeyField();
    syncOrganizeButtonState();
  });
}

export function initAiController(): void {
  hydrateKeyField();
  syncOrganizeButtonState();
  updateMergeButtonState();
  registerStorageListener();
  modalOrganizeButton.addEventListener("click", () => {
    void handleOrganizeClick();
  });
  aiApiKeySaveButton.addEventListener("click", handleKeySave);
  aiApiKeyClearButton.addEventListener("click", handleKeyClear);
  noteAssistantDismissButton.addEventListener("click", dismissBanner);
  noteAssistantMergeButton.addEventListener("click", () => {
    void handleMergeNotes();
  });
}
