import {
  categoryFilter,
  categoryInput,
  deleteButton,
  emptyState,
  form,
  noteIdInput,
  notesContainer,
  paginationControls,
  paginationStatus,
  prevPageButton,
  nextPageButton,
  titleInput
} from "./dom";
import { setEditorValue } from "./editor";
import { formatDate, getState, updateState } from "./state";
import { Note } from "./types";

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

export function setActiveNote(id: string | null): void {
  updateState({ selectedNoteId: id });
  noteIdInput.value = id ?? "";
  deleteButton.disabled = !id;

  notesContainer
    .querySelectorAll<HTMLLIElement>(".note-card")
    .forEach((item) => {
      item.classList.toggle("active", item.dataset.id === id);
    });
}

export function populateForm(note: Note | null): void {
  if (note) {
    noteIdInput.value = note.id;
    titleInput.value = note.title;
    categoryInput.value = note.category;
    setEditorValue(note.content);
    setActiveNote(note.id);
  } else {
    form.reset();
    noteIdInput.value = "";
    categoryInput.value = "";
    setEditorValue("");
    setActiveNote(null);
  }
}

export function renderNotesList(
  filter = "",
  onSelect?: (note: Note) => void
): void {
  const state = getState();
  notesContainer.classList.toggle("compact", state.compactView);
  const query = filter.trim().toLowerCase();
  const categories = Object.keys(state.categoryIndex).sort((a, b) =>
    a.localeCompare(b)
  );

  if (state.activeCategory && !categories.includes(state.activeCategory)) {
    updateState({ activeCategory: null });
  }

  categoryFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = categories.length ? "All categories" : "All categories";
  categoryFilter.appendChild(allOption);

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }

  const activeCategoryValue = state.activeCategory ?? "";
  categoryFilter.value = categories.includes(activeCategoryValue)
    ? activeCategoryValue
    : "";
  categoryFilter.disabled = categories.length === 0;

  const activeCategory = state.activeCategory ?? null;
  const activeCategoryIds = activeCategory
    ? new Set(state.categoryIndex[activeCategory] ?? [])
    : null;

  const notes = state.notes
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((note) => {
      if (!query) return true;
      const titleText = note.title.toLowerCase();
      const contentText = note.content.toLowerCase();
      return titleText.includes(query) || contentText.includes(query);
    })
    .filter((note) => {
      if (!activeCategoryIds) return true;
      return activeCategoryIds.has(note.id);
    });

  notesContainer.innerHTML = "";

  if (!notes.length) {
    emptyState.hidden = false;
    emptyState.textContent = state.notes.length
      ? "No matching notes found."
      : "No notes yet. Start writing and they will appear here.";
    paginationControls.classList.add("hidden");
    paginationControls.setAttribute("hidden", "");
    return;
  }

  emptyState.hidden = true;
  emptyState.textContent =
    "No notes yet. Start writing and they will appear here.";

  const totalPages = Math.max(1, Math.ceil(notes.length / state.notesPerPage));
  let currentPage = clampPage(state.currentPage, totalPages);

  if (currentPage !== state.currentPage) {
    updateState({ currentPage });
  }

  const startIndex = (currentPage - 1) * state.notesPerPage;
  const pageNotes = notes.slice(startIndex, startIndex + state.notesPerPage);

  pageNotes.forEach((note) => {
    const listItem = document.createElement("li");
    listItem.className = "note-card";
    listItem.dataset.id = note.id;

    const title = document.createElement("h3");
    title.className = "note-title";
    title.textContent = note.title || "Untitled note";

    const categoryBadge = note.category
      ? (() => {
          const badge = document.createElement("span");
          badge.className = "note-category";
          badge.textContent = note.category;
          return badge;
        })()
      : null;

    const meta = document.createElement("span");
    meta.className = "note-meta";
    meta.textContent = `Updated ${formatDate(note.updatedAt)}`;

    const preview = document.createElement("p");
    preview.className = "note-preview";
    const contentText = note.content;
    preview.textContent = contentText
      ? `${contentText.slice(0, 140).trim()}${
          contentText.length > 140 ? "…" : ""
        }`
      : "No content";

    listItem.append(title);
    if (categoryBadge) {
      listItem.append(categoryBadge);
    }
    listItem.append(meta, preview);
    listItem.addEventListener("click", () => {
      populateForm(note);
      onSelect?.(note);
    });

    if (note.id === state.selectedNoteId) {
      listItem.classList.add("active");
    }

    notesContainer.appendChild(listItem);
  });

  paginationStatus.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
  if (totalPages <= 1) {
    paginationControls.classList.add("hidden");
    paginationControls.setAttribute("hidden", "");
  } else {
    paginationControls.classList.remove("hidden");
    paginationControls.removeAttribute("hidden");
  }
}

export function restoreFormToState(): void {
  const state = getState();
  if (state.selectedNoteId) {
    const note = state.notes.find((entry) => entry.id === state.selectedNoteId);
    if (note) {
      populateForm(note);
      return;
    }
  }
  populateForm(null);
}
