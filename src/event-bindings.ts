import {
  categoryFilter,
  categoryInput,
  compactToggle,
  contentEditor,
  deleteButton,
  exportNotesButton,
  form,
  importNotesInput,
  layoutChoiceInputs,
  modalBackdrop,
  modalCancelButton,
  modalRedoButton,
  modalUndoButton,
  modalCopyButton,
  modalMaximizeButton,
  newNoteButton,
  nextPageButton,
  prevPageButton,
  searchInput,
  settingsButton,
  settingsCloseButton,
  settingsOverlay,
  settingsPanel,
  settingsTabButtons,
  syncToggle,
  themeChoiceInputs,
  themeToggle,
  appearanceThemeChoiceInputs,
  titleInput
} from "./dom";
import { Theme, AppearanceTheme } from "./types";
import { getState, persistState } from "./state";
import { toggleModalSize, isModalOpen } from "./modal";
import {
  applyCompactView,
  applySyncPreference,
  applyTheme,
  applyAppearanceTheme,
  applyViewMode,
  chromeSyncAvailable,
  closeSettingsPanel,
  isLightTheme,
  isSettingsPanelOpen,
  setActiveSettingsTab,
  toggleSettingsPanel
} from "./controllers/settings-controller";
import {
  handleFormFieldChange,
  handleFormSubmit,
  resetAutoSaveState
} from "./controllers/autosave-controller";
import { exportNotesToFile } from "./services/data-transfer";

type EventBindingOptions = {
  onNewNote: () => void;
  onDeleteNote: () => void;
  onModalDismiss: () => void;
  onImportNotes: (event: Event) => void;
  onSearchInput: (value: string) => void;
  onGoToPreviousPage: () => void;
  onGoToNextPage: () => void;
  onCopyNote: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function bindEventListeners(options: EventBindingOptions): void {
  form.addEventListener("submit", (event) => {
    void handleFormSubmit(event);
  });

  titleInput.addEventListener("input", handleFormFieldChange);
  categoryInput.addEventListener("input", handleFormFieldChange);
  contentEditor.addEventListener("input", handleFormFieldChange);

  newNoteButton.addEventListener("click", options.onNewNote);

  deleteButton.addEventListener("click", options.onDeleteNote);

  modalCancelButton.addEventListener("click", options.onModalDismiss);
  modalCopyButton.addEventListener("click", options.onCopyNote);
  modalUndoButton.addEventListener("click", options.onUndo);
  modalRedoButton.addEventListener("click", options.onRedo);

  modalBackdrop.addEventListener("click", (event) => {
    if (getState().viewMode === "list" && event.target === modalBackdrop) {
      options.onModalDismiss();
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
    options.onSearchInput(target.value);
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

  appearanceThemeChoiceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const selectedTheme = input.value as AppearanceTheme;
      void applyAppearanceTheme(selectedTheme);
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
      void applyViewMode(mode).then(() => {
        resetAutoSaveState();
      });
    });
  });

  categoryFilter.addEventListener("change", () => {
    const value = categoryFilter.value.trim();
    const activeCategory = value.length ? value : null;
    void persistState({ activeCategory, currentPage: 1 });
    options.onSearchInput(searchInput.value);
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

  exportNotesButton.addEventListener("click", () => {
    exportNotesToFile();
  });

  importNotesInput.addEventListener("change", (event) => {
    void options.onImportNotes(event);
  });

  prevPageButton.addEventListener("click", options.onGoToPreviousPage);

  nextPageButton.addEventListener("click", options.onGoToNextPage);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (getState().viewMode === "list" && isModalOpen()) {
        options.onModalDismiss();
        return;
      }
      if (isSettingsPanelOpen()) {
        closeSettingsPanel();
      }
    }
  });
}
