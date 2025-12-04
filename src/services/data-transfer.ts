import { Note } from "../types";
import { getState, persistState, normalizeNotesPayload } from "../state";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function buildExportFileName(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `chromnotes-notes-${date}_${time}.txt`;
}

export function formatNotesForExport(notes: Note[]): string {
  const serialized = JSON.stringify(notes, null, 2);
  return serialized.endsWith("\n") ? serialized : `${serialized}\n`;
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

export function exportNotesToFile(): void {
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

function validateImportedNotes(data: unknown): Note[] | null {
  const parsed = normalizeNotesPayload(data);
  if (!parsed.length) {
    return null;
  }
  return parsed;
}

export function parseNotesFromText(text: string): Note[] {
  const parsed = JSON.parse(text) as unknown;
  const notes = validateImportedNotes(parsed);
  if (!notes) {
    throw new Error("Chromnotes: invalid notes file.");
  }
  return notes;
}

export async function persistImportedNotes(notes: Note[]): Promise<void> {
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
}
