import {
  compactToggle,
  layoutChoiceInputs,
  modalBackdrop,
  modalCancelButton,
  modalMaximizeButton,
  settingsButton,
  settingsOverlay,
  settingsPanel,
  settingsTabButtons,
  settingsTabPanels,
  syncToggle,
  themeChoiceInputs,
  themeToggle,
  appearanceThemeChoiceInputs,
  headerSearchSlot,
  listSearchHome,
  searchFieldWrapper
} from "../dom";
import { openModal, closeModal, setModalMaximized } from "../modal";
import { Theme, AppearanceTheme } from "../types";
import { getState, updateState, persistState, isChromeSyncAvailable } from "../state";
import { ensureAppearanceThemeStyles } from "../services/theme-loader";

const chromeSyncAvailable = isChromeSyncAvailable();
const LIGHT_THEME_SET = new Set<Theme>(["light", "dawn", "paper", "girly-girl"]);
const DEFAULT_SETTINGS_TAB = settingsTabButtons[0]?.dataset.settingsTab ?? "palettes";
let activeSettingsTab = DEFAULT_SETTINGS_TAB;
let settingsOpen = false;
let refreshNotesListCallback: (() => void) | null = null;

function moveSearchWrapper(target: HTMLElement | null): void {
  if (!target || !searchFieldWrapper) {
    return;
  }
  if (searchFieldWrapper.parentElement === target) {
    return;
  }
  target.appendChild(searchFieldWrapper);
}

function syncSearchPlacement(theme: AppearanceTheme): void {
  if (!headerSearchSlot || !listSearchHome) {
    return;
  }
  if (theme === "windup") {
    headerSearchSlot.classList.add("is-active");
    listSearchHome.classList.add("is-hidden");
    moveSearchWrapper(headerSearchSlot);
  } else {
    headerSearchSlot.classList.remove("is-active");
    listSearchHome.classList.remove("is-hidden");
    moveSearchWrapper(listSearchHome);
  }
}

export function registerSettingsNotesRefresh(callback: () => void): void {
  refreshNotesListCallback = callback;
}

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

export function isLightTheme(theme: Theme): boolean {
  return LIGHT_THEME_SET.has(theme);
}

export function refreshSettingsControls(): void {
  const state = getState();
  themeToggle.checked = !isLightTheme(state.theme);
  themeChoiceInputs.forEach((input) => {
    input.checked = input.value === state.theme;
  });
  appearanceThemeChoiceInputs.forEach((input) => {
    input.checked = input.value === state.appearanceTheme;
  });
  compactToggle.checked = state.compactView;
  syncToggle.checked = state.useChromeSync && chromeSyncAvailable;
  syncToggle.disabled = !chromeSyncAvailable;
  layoutChoiceInputs.forEach((input) => {
    input.checked = input.value === state.viewMode;
  });
}

export function setActiveSettingsTab(tabId: string, options: { focus?: boolean } = {}): void {
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

export function applyTheme(theme: Theme): void {
  const nextTheme: Theme = theme;
  updateState({ theme: nextTheme });
  document.body.dataset.theme = nextTheme;
  refreshSettingsControls();
}

export async function applyAppearanceTheme(
  theme: AppearanceTheme,
  options: { persist?: boolean } = {}
): Promise<void> {
  const { persist = true } = options;
  await ensureAppearanceThemeStyles(theme);
  updateState({ appearanceTheme: theme });
  document.body.dataset.appearanceTheme = theme;
  syncSearchPlacement(theme);
  refreshSettingsControls();
  if (persist) {
    await persistState({ appearanceTheme: theme });
  }
}

export function applyCompactView(
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
    refreshNotesListCallback?.();
  }
}

export async function applySyncPreference(
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

export async function applyViewMode(
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
  refreshSettingsControls();
  if (persist) {
    await persistState({ viewMode });
  }
}

export function openSettingsPanel(): void {
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

export function closeSettingsPanel(): void {
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

export function toggleSettingsPanel(): void {
  if (settingsOpen) {
    closeSettingsPanel();
  } else {
    openSettingsPanel();
  }
}

export function isSettingsPanelOpen(): boolean {
  return settingsOpen;
}

export { chromeSyncAvailable };
