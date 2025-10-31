import { modal, modalBackdrop, modalMaximizeButton, titleInput } from "./dom";

let isModalMaximized = false;

export function getModalMaximized(): boolean {
  return isModalMaximized;
}

export function isModalOpen(): boolean {
  return !modalBackdrop.classList.contains("hidden");
}

export function applyModalSize(): void {
  if (isModalMaximized) {
    modal.classList.add("modal--maximized");
    modalMaximizeButton.setAttribute("aria-label", "Restore note editor size");
    modalMaximizeButton.textContent = "⤡";
  } else {
    modal.classList.remove("modal--maximized");
    modalMaximizeButton.setAttribute("aria-label", "Maximize note editor");
    modalMaximizeButton.textContent = "⤢";
  }
}

export function setModalMaximized(value: boolean): void {
  isModalMaximized = value;
  applyModalSize();
}

export function toggleModalSize(): void {
  setModalMaximized(!isModalMaximized);
}

export function openModal(mode: "create" | "edit"): void {
  modal.dataset.mode = mode;
  modalBackdrop.classList.remove("hidden");
  modalBackdrop.removeAttribute("hidden");
  applyModalSize();
  if (document.body.dataset.layout !== "desktop") {
    document.body.classList.add("modal-open");
  }
  window.setTimeout(() => {
    titleInput.focus();
    titleInput.select();
  }, 0);
}

export function closeModal(): void {
  if (document.body.dataset.layout === "desktop") {
    document.body.classList.remove("modal-open");
    return;
  }
  modalBackdrop.classList.add("hidden");
  modalBackdrop.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
  delete modal.dataset.mode;
}
