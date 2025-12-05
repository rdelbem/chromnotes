import type { OutputData } from "@editorjs/editorjs";

export const THEMES = [
  "light",
  "dark",
  "dracula",
  "dawn",
  "paper",
  "midnight",
  "forest",
  "github",
  "girly-girl"
] as const;

export const APPEARANCE_THEMES = ["classic", "windup"] as const;

export type Theme = (typeof THEMES)[number];
export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];

export type SerializedEditorData = OutputData;

export type Note = {
  id: string;
  title: string;
  content: string;
  contentRaw: SerializedEditorData | null;
  createdAt: number;
  updatedAt: number;
  category: string;
};

export type ChromnotesState = {
  notes: Note[];
  categoryIndex: Record<string, string[]>;
  theme: Theme;
  appearanceTheme: AppearanceTheme;
  selectedNoteId: string | null;
  currentPage: number;
  notesPerPage: number;
  compactView: boolean;
  useChromeSync: boolean;
  activeCategory: string | null;
  viewMode: "list" | "desktop";
};

export const STORAGE_FALLBACK_KEY = "chromnotes_state";

export const defaultState: ChromnotesState = {
  notes: [],
  categoryIndex: {},
  theme: "dark",
  appearanceTheme: "classic",
  selectedNoteId: null,
  currentPage: 1,
  notesPerPage: 10,
  compactView: false,
  useChromeSync: false,
  activeCategory: null,
  viewMode: "list"
};
