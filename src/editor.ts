import { contentEditor } from "./dom";

function ensureEditorPlaceholder(): void {
  if (contentEditor.innerText.replace(/\u00a0/g, " ").trim().length === 0) {
    contentEditor.innerHTML = "";
  }
}

export function getEditorValue(): string {
  const text = contentEditor.innerText.replace(/\u00a0/g, " ");
  const normalized = text.replace(/\r?\n/g, "\n").trim();
  ensureEditorPlaceholder();
  return normalized;
}

export function setEditorValue(value: string): void {
  const normalized = value.replace(/\r?\n/g, "\n");
  contentEditor.innerText = normalized;
  ensureEditorPlaceholder();
}

export function initEditor(): void {
  contentEditor.addEventListener("input", ensureEditorPlaceholder);
  contentEditor.addEventListener("blur", ensureEditorPlaceholder);
  contentEditor.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
    ensureEditorPlaceholder();
  });
}
