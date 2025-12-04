export function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Chromnotes: missing required element with id "${id}".`);
  }
  return element as T;
}

export const form = requireElement<HTMLFormElement>("noteForm");
export const titleInput = requireElement<HTMLInputElement>("noteTitle");
export const categoryInput = requireElement<HTMLInputElement>("noteCategory");
export const contentEditor = requireElement<HTMLDivElement>("noteContent");
export const noteIdInput = requireElement<HTMLInputElement>("noteId");
export const notesContainer = requireElement<HTMLUListElement>("notesContainer");
export const emptyState = requireElement<HTMLParagraphElement>("emptyState");
export const searchInput = requireElement<HTMLInputElement>("searchInput");
export const categoryFilter = requireElement<HTMLSelectElement>("categoryFilter");
export const themeToggle = requireElement<HTMLInputElement>("themeToggle");
export const newNoteButton = requireElement<HTMLButtonElement>("newNoteButton");
export const deleteButton = requireElement<HTMLButtonElement>("modalDeleteButton");
export const modalBackdrop = requireElement<HTMLDivElement>("modalBackdrop");
export const modal = requireElement<HTMLDivElement>("noteModal");
export const modalCancelButton = requireElement<HTMLButtonElement>("modalCancelButton");
export const modalMaximizeButton = requireElement<HTMLButtonElement>("modalMaximizeButton");
export const modalOrganizeButton = requireElement<HTMLButtonElement>("modalOrganizeButton");
export const settingsButton = requireElement<HTMLButtonElement>("settingsButton");
export const settingsPanel = requireElement<HTMLDivElement>("settingsPanel");
export const settingsCloseButton = requireElement<HTMLButtonElement>("settingsCloseButton");
export const settingsOverlay = requireElement<HTMLDivElement>("settingsOverlay");
const settingsTabButtonNodeList =
  document.querySelectorAll<HTMLButtonElement>("[data-settings-tab]");
if (!settingsTabButtonNodeList.length) {
  throw new Error("Chromnotes: missing settings tab buttons.");
}
export const settingsTabButtons = Array.from(settingsTabButtonNodeList);
const settingsTabPanelNodeList = document.querySelectorAll<HTMLElement>("[data-settings-panel]");
if (!settingsTabPanelNodeList.length) {
  throw new Error("Chromnotes: missing settings tab panels.");
}
export const settingsTabPanels = Array.from(settingsTabPanelNodeList);
export const paginationControls = requireElement<HTMLElement>("paginationControls");
export const paginationStatus = requireElement<HTMLSpanElement>("paginationStatus");
export const prevPageButton = requireElement<HTMLButtonElement>("prevPageButton");
export const nextPageButton = requireElement<HTMLButtonElement>("nextPageButton");
export const compactToggle = requireElement<HTMLInputElement>("compactToggle");
export const syncToggle = requireElement<HTMLInputElement>("syncToggle");
export const exportNotesButton = requireElement<HTMLButtonElement>("exportNotesButton");
export const importNotesInput = requireElement<HTMLInputElement>("importNotesInput");
export const importNotesStatus = requireElement<HTMLParagraphElement>("importNotesStatus");
export const modalDeleteButton = requireElement<HTMLButtonElement>("modalDeleteButton");
export const modalSaveButton = requireElement<HTMLButtonElement>("modalSaveButton");
export const noteAssistantBanner = requireElement<HTMLDivElement>("noteAssistantBanner");
export const noteAssistantText = requireElement<HTMLParagraphElement>("noteAssistantText");
export const noteAssistantDismissButton = requireElement<HTMLButtonElement>(
  "noteAssistantDismissButton"
);
export const noteAssistantMergeButton = requireElement<HTMLButtonElement>(
  "noteAssistantMergeButton"
);
export const aiApiKeyInput = requireElement<HTMLInputElement>("aiApiKeyInput");
export const aiApiKeySaveButton = requireElement<HTMLButtonElement>("aiApiKeySaveButton");
export const aiApiKeyClearButton = requireElement<HTMLButtonElement>("aiApiKeyClearButton");
export const aiApiKeyStatus = requireElement<HTMLParagraphElement>("aiApiKeyStatus");

const themeChoiceNodeList = document.querySelectorAll<HTMLInputElement>(
  'input[name="themeChoice"]'
);

if (!themeChoiceNodeList.length) {
  throw new Error("Chromnotes: missing theme choice inputs.");
}

export const themeChoiceInputs = Array.from(themeChoiceNodeList);

const layoutChoiceNodeList = document.querySelectorAll<HTMLInputElement>(
  'input[name="layoutChoice"]'
);

if (!layoutChoiceNodeList.length) {
  throw new Error("Chromnotes: missing layout choice inputs.");
}

export const layoutChoiceInputs = Array.from(layoutChoiceNodeList);
