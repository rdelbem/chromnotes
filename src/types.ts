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

export type Theme = (typeof THEMES)[number];

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  category: string;
};

export type ChromnotesState = {
  notes: Note[];
  categoryIndex: Record<string, string[]>;
  theme: Theme;
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
  selectedNoteId: null,
  currentPage: 1,
  notesPerPage: 10,
  compactView: false,
  useChromeSync: false,
  activeCategory: null,
  viewMode: "list"
};
