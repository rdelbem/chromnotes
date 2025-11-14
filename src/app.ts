import {
  deleteButton,
  form,
  modalBackdrop,
  modal,
  modalCancelButton,
  modalMaximizeButton,
  newNoteButton,
  noteIdInput,
  searchInput,
  nextPageButton,
  settingsButton,
  settingsPanel,
  settingsCloseButton,
  settingsOverlay,
  settingsTabButtons,
  settingsTabPanels,
  prevPageButton,
  categoryInput,
  categoryFilter,
  compactToggle,
  syncToggle,
  themeChoiceInputs,
  layoutChoiceInputs,
  themeToggle,
  titleInput,
  contentEditor,
  exportNotesButton,
  importNotesInput,
  importNotesStatus,
  modalSaveButton
} from "./dom";
import { getEditorData, getEditorValue, refreshEditorCache, initEditor } from "./editor";
import {
  applyModalSize,
  closeModal,
  isModalOpen,
  openModal,
  setModalMaximized,
  toggleModalSize
} from "./modal";
import {
  generateId,
  getState,
  getTotalPages,
  isChromeSyncAvailable,
  loadState,
  persistState,
  updateState,
  normalizeNotesPayload
} from "./state";
import { Note, Theme, STORAGE_FALLBACK_KEY } from "./types";
import { populateForm, renderNotesList, restoreFormToState } from "./view";

let settingsOpen = false;
const chromeSyncAvailable = isChromeSyncAvailable();
const AUTO_SAVE_DELAY_MS = 60_000;
let autoSaveTimer: number | null = null;
const AUTO_SAVE_GLOW_DURATION_MS = 2_000;
let autoSaveGlowTimer: number | null = null;
const AUTO_SAVE_GLOW_CLASS = "modal-save-button--autosaved";
const LIGHT_THEME_SET = new Set<Theme>(["light", "dawn", "paper", "girly-girl"]);
const DEFAULT_SETTINGS_TAB = settingsTabButtons[0]?.dataset.settingsTab ?? "appearance";
let activeSettingsTab = DEFAULT_SETTINGS_TAB;
let importStatusTimer: number | null = null;

function isLightTheme(theme: Theme): boolean {
  return LIGHT_THEME_SET.has(theme);
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

function refreshNotesList(): void {
  renderNotesList(searchInput.value, handleNoteSelection);
}

function handleNoteSelection(note: Note): void {
  void persistState({ selectedNoteId: note.id });
  openModal("edit");
  resetAutoSaveState();
}

function refreshSettingsControls(): void {
  const state = getState();
  themeToggle.checked = !isLightTheme(state.theme);
  themeChoiceInputs.forEach((input) => {
    input.checked = input.value === state.theme;
  });
  compactToggle.checked = state.compactView;
  syncToggle.checked = state.useChromeSync && chromeSyncAvailable;
  syncToggle.disabled = !chromeSyncAvailable;
  layoutChoiceInputs.forEach((input) => {
    input.checked = input.value === state.viewMode;
  });
}

function setActiveSettingsTab(tabId: string, options: { focus?: boolean } = {}): void {
  const { focus = false } = options;
  if (!settingsTabButtons.length || !settingsTabPanels.length) {
    return;
  }

  const availableTabs = new Set(settingsTabButtons.map((button) => button.dataset.settingsTab));
  const normalized = availableTabs.has(tabId) ? tabId : DEFAULT_SETTINGS_TAB;
  activeSettingsTab = normalized ?? DEFAULT_SETTINGS_TAB;

  settingsTabButtons.forEach((button) => {
    const id = button.dataset.settingsTab;
    const isActive = id === activeSettingsTab;
    button.classList.toggle("settings-tab--active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    if (isActive && focus) {
      button.focus();
    }
  });

  settingsTabPanels.forEach((panel) => {
    const id = panel.dataset.settingsPanel;
    const isActive = id === activeSettingsTab;
    panel.classList.toggle("is-active", isActive);
    if (isActive) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });
}

setActiveSettingsTab(activeSettingsTab);

function updateModalControls(viewMode: "list" | "desktop"): void {
  const isDesktopView = viewMode === "desktop";
  const syncButtonState = (button: HTMLButtonElement): void => {
    if (isDesktopView) {
      button.hidden = true;
      button.setAttribute("aria-hidden", "true");
      button.tabIndex = -1;
    } else {
      button.hidden = false;
      button.removeAttribute("aria-hidden");
      button.tabIndex = 0;
    }
  };

  syncButtonState(modalMaximizeButton);
  syncButtonState(modalCancelButton);
}

function applyTheme(theme: Theme): void {
  const nextTheme: Theme = theme;
  updateState({ theme: nextTheme });
  document.body.dataset.theme = nextTheme;
  refreshSettingsControls();
}

function applyCompactView(
  compact: boolean,
  options: { refresh?: boolean; syncState?: boolean } = {}
): void {
  const { refresh = true, syncState = true } = options;
  if (syncState) {
    updateState({ compactView: compact });
  }
  document.body.classList.toggle("compact-list", compact);
  refreshSettingsControls();
  if (refresh) {
    refreshNotesList();
  }
}

async function applySyncPreference(
  syncEnabled: boolean,
  options: { persist?: boolean } = {}
): Promise<void> {
  const { persist = true } = options;
  if (!chromeSyncAvailable && syncEnabled) {
    console.warn("Chromnotes: Chrome sync not available in this environment.");
    refreshSettingsControls();
    return;
  }

  updateState({ useChromeSync: syncEnabled && chromeSyncAvailable });
  refreshSettingsControls();

  if (persist) {
    await persistState({ useChromeSync: getState().useChromeSync });
  }
}

async function applyViewMode(
  viewMode: "list" | "desktop",
  options: { persist?: boolean } = {}
): Promise<void> {
  const { persist = true } = options;
  const previousViewMode = getState().viewMode;
  updateState({ viewMode });
  document.body.dataset.layout = viewMode;
  document.body.classList.toggle("compact-list", getState().compactView);
  if (viewMode === "desktop") {
    setModalMaximized(true);
    modalBackdrop.classList.remove("hidden");
    modalBackdrop.removeAttribute("hidden");
    const mode = getState().selectedNoteId ? "edit" : "create";
    openModal(mode);
  } else {
    if (previousViewMode === "desktop") {
      setModalMaximized(false);
    }
    closeModal();
  }
  updateModalControls(viewMode);
  resetAutoSaveState();
  refreshSettingsControls();
  if (persist) {
    await persistState({ viewMode });
  }
}

function handleModalDismiss(): void {
  restoreFormToState();
  if (getState().viewMode === "list") {
    closeModal();
  }
  resetAutoSaveState();
}

function openSettingsPanel(): void {
  if (settingsOpen) return;
  settingsOpen = true;
  settingsPanel.classList.remove("hidden");
  settingsPanel.removeAttribute("hidden");
  settingsButton.setAttribute("aria-expanded", "true");
  settingsOverlay.classList.remove("hidden");
  settingsOverlay.removeAttribute("hidden");
  document.body.classList.add("settings-modal-open");
  setActiveSettingsTab(activeSettingsTab, { focus: true });
}

function closeSettingsPanel(): void {
  if (!settingsOpen) return;
  settingsOpen = false;
  settingsPanel.classList.add("hidden");
  settingsPanel.setAttribute("hidden", "");
  settingsButton.setAttribute("aria-expanded", "false");
  settingsOverlay.classList.add("hidden");
  settingsOverlay.setAttribute("hidden", "");
  document.body.classList.remove("settings-modal-open");
  settingsButton.focus();
}

function toggleSettingsPanel(): void {
  if (settingsOpen) {
    closeSettingsPanel();
  } else {
    openSettingsPanel();
  }
}

async function handleFormSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  await saveCurrentNote("manual");
}

type SaveReason = "manual" | "auto";

function resetAutoSaveState(): void {
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
  // Force reflow so the animation can restart if it was already active.
  void modalSaveButton.offsetWidth;
  modalSaveButton.classList.add(AUTO_SAVE_GLOW_CLASS);
  autoSaveGlowTimer = window.setTimeout(() => {
    modalSaveButton.classList.remove(AUTO_SAVE_GLOW_CLASS);
    autoSaveGlowTimer = null;
  }, AUTO_SAVE_GLOW_DURATION_MS);
}

function getFormSnapshot(): {
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

  if (!snapshot.title && !snapshot.content) {
    if (reason === "manual") {
      titleInput.focus();
    }
    resetAutoSaveState();
    return false;
  }

  const timestamp = Date.now();
  const currentState = getState();
  let nextNotes: Note[];

  if (snapshot.id) {
    nextNotes = currentState.notes.map((note) =>
      note.id === snapshot.id
        ? {
            ...note,
            title: snapshot.title,
            content: snapshot.content,
            contentRaw: snapshot.contentRaw,
            category: snapshot.category,
            updatedAt: timestamp
          }
        : note
    );
  } else {
    nextNotes = [
      ...currentState.notes,
      {
        id: generateId(),
        title: snapshot.title,
        content: snapshot.content,
        contentRaw: snapshot.contentRaw,
        category: snapshot.category,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  }

  const selected = snapshot.id
    ? (nextNotes.find((note) => note.id === snapshot.id) ?? null)
    : (nextNotes[nextNotes.length - 1] ?? null);

  await persistState({
    notes: nextNotes,
    selectedNoteId: selected?.id ?? null,
    currentPage: 1
  });

  refreshNotesList();
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
  return true;
}

function handleFormFieldChange(): void {
  if (!isEditingExistingNote()) {
    resetAutoSaveState();
    return;
  }
  if (!hasFormChanges()) {
    resetAutoSaveState();
    return;
  }
  scheduleAutoSave();
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

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function buildExportFileName(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `chromnotes-notes-${date}_${time}.txt`;
}

function formatNotesForExport(notes: Note[]): string {
  const serialized = JSON.stringify(notes, null, 2);
  return serialized.endsWith("\n") ? serialized : `${serialized}\n`;
}

function validateImportedNotes(data: unknown): Note[] | null {
  const parsed = normalizeNotesPayload(data);
  if (!parsed.length) {
    return null;
  }
  return parsed;
}

async function persistImportedNotes(notes: Note[]): Promise<void> {
  const existing = getState();
  const mergedMap = new Map<string, Note>();

  existing.notes.forEach((note) => {
    mergedMap.set(note.id, note);
  });

  notes.forEach((note) => {
    const current = mergedMap.get(note.id);
    if (!current || note.updatedAt >= current.updatedAt) {
      mergedMap.set(note.id, note);
    }
  });

  const mergedNotes = Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);

  await persistState({
    notes: mergedNotes,
    selectedNoteId: mergedNotes.length ? mergedNotes[mergedNotes.length - 1].id : null,
    currentPage: 1
  });

  refreshNotesList();
  const state = getState();
  if (state.selectedNoteId) {
    const selectedNote = state.notes.find((note) => note.id === state.selectedNoteId);
    populateForm(selectedNote ?? null);
  } else {
    populateForm(null);
  }
}

function createDownloadTarget(content: string): { href: string; cleanup: () => void } {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    return {
      href: objectUrl,
      cleanup: () => {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }

  const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;
  return {
    href: dataUrl,
    cleanup: () => {
      /* no-op */
    }
  };
}

function handleExportNotes(): void {
  const notes = getState().notes;
  const content = formatNotesForExport(notes);
  const filename = buildExportFileName();
  const { href, cleanup } = createDownloadTarget(content);

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.position = "absolute";
  anchor.style.left = "-9999px";

  document.body.appendChild(anchor);
  anchor.click();

  const finalize = (): void => {
    anchor.remove();
    cleanup();
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(finalize);
  } else {
    window.setTimeout(finalize, 0);
  }
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
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const notes = validateImportedNotes(parsed);
    if (!notes) {
      throw new Error("Chromnotes: invalid notes file.");
    }
    await persistImportedNotes(notes);
    importNotesStatus.textContent = `Imported ${notes.length} note${notes.length === 1 ? "" : "s"}.`;
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

function bindEventListeners(): void {
  form.addEventListener("submit", (event) => {
    void handleFormSubmit(event);
  });

  titleInput.addEventListener("input", handleFormFieldChange);
  categoryInput.addEventListener("input", handleFormFieldChange);
  contentEditor.addEventListener("input", handleFormFieldChange);

  newNoteButton.addEventListener("click", () => {
    void handleNewNote();
  });

  deleteButton.addEventListener("click", () => {
    void handleDeleteNote();
  });

  modalCancelButton.addEventListener("click", handleModalDismiss);

  modalBackdrop.addEventListener("click", (event) => {
    if (getState().viewMode === "list" && event.target === modalBackdrop) {
      handleModalDismiss();
    }
  });

  modalMaximizeButton.addEventListener("click", () => {
    if (getState().viewMode === "desktop") {
      return;
    }
    toggleModalSize();
  });

  searchInput.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    updateState({ currentPage: 1 });
    renderNotesList(target.value, handleNoteSelection);
  });

  themeToggle.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    const currentTheme = getState().theme;
    let nextTheme: Theme = currentTheme;

    if (target.checked) {
      if (isLightTheme(currentTheme)) {
        nextTheme = "dark";
      }
    } else if (!isLightTheme(currentTheme)) {
      nextTheme = "light";
    }

    if (nextTheme !== currentTheme) {
      applyTheme(nextTheme);
      void persistState({ theme: nextTheme });
    } else {
      refreshSettingsControls();
    }
  });

  themeChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const selectedTheme = input.value as Theme;
      applyTheme(selectedTheme);
      void persistState({ theme: selectedTheme });
    });
  });

  compactToggle.addEventListener("change", () => {
    const compact = compactToggle.checked;
    applyCompactView(compact);
    void persistState({ compactView: compact });
  });

  layoutChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const mode = input.value === "desktop" ? "desktop" : "list";
      void applyViewMode(mode);
    });
  });

  categoryFilter.addEventListener("change", () => {
    const value = categoryFilter.value.trim();
    const activeCategory = value.length ? value : null;
    void persistState({ activeCategory, currentPage: 1 });
    refreshNotesList();
  });

  syncToggle.addEventListener("change", () => {
    if (!chromeSyncAvailable) {
      syncToggle.checked = false;
      return;
    }
    const enabled = syncToggle.checked;
    void applySyncPreference(enabled);
  });

  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });

  settingsPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  settingsTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.settingsTab;
      if (!tabId) return;
      setActiveSettingsTab(tabId, { focus: true });
    });

    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const currentIndex = settingsTabButtons.findIndex((candidate) => candidate === button);
      if (currentIndex === -1) {
        return;
      }
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + offset + settingsTabButtons.length) % settingsTabButtons.length;
      const nextButton = settingsTabButtons[nextIndex];
      const tabId = nextButton?.dataset.settingsTab;
      if (!tabId) {
        return;
      }
      setActiveSettingsTab(tabId, { focus: true });
    });
  });

  settingsCloseButton.addEventListener("click", () => {
    closeSettingsPanel();
  });

  settingsOverlay.addEventListener("click", () => {
    closeSettingsPanel();
  });

  exportNotesButton.addEventListener("click", handleExportNotes);
  importNotesInput.addEventListener("change", (event) => {
    void handleImportNotes(event);
  });

  prevPageButton.addEventListener("click", () => {
    void goToPage(getState().currentPage - 1);
  });

  nextPageButton.addEventListener("click", () => {
    void goToPage(getState().currentPage + 1);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (getState().viewMode === "list" && isModalOpen()) {
        handleModalDismiss();
        return;
      }
      if (settingsOpen) {
        closeSettingsPanel();
      }
    }
  });
}

export async function bootstrap(): Promise<void> {
  closeModal();
  applyModalSize();
  closeSettingsPanel();
  initEditor();

  const initialState = await loadState();
  syncToggle.disabled = !chromeSyncAvailable;
  await applySyncPreference(chromeSyncAvailable && initialState.useChromeSync, {
    persist: false
  });
  applyTheme(initialState.theme);
  applyCompactView(initialState.compactView, { refresh: false, syncState: false });
  refreshNotesList();

  if (initialState.selectedNoteId) {
    const current = initialState.notes.find((note) => note.id === initialState.selectedNoteId);
    if (current) {
      populateForm(current);
    } else {
      populateForm(null);
      await persistState({ selectedNoteId: null });
    }
  } else {
    populateForm(null);
  }

  await applyViewMode(initialState.viewMode, { persist: false });
  refreshSettingsControls();

  window.addEventListener("storage", async (event) => {
    if (event.key !== STORAGE_FALLBACK_KEY) return;
    await loadState();
    applyTheme(getState().theme);
    applyCompactView(getState().compactView, { refresh: false, syncState: false });
    await applyViewMode(getState().viewMode, { persist: false });
    refreshNotesList();
    restoreFormToState();
    refreshSettingsControls();
    resetAutoSaveState();
  });

  bindEventListeners();
}
