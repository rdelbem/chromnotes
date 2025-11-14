import fs from "node:fs";
import path from "node:path";

import { STORAGE_FALLBACK_KEY, defaultState, type ChromnotesState } from "../types";

const htmlPath = path.resolve(__dirname, "../../index.html");
const cssPath = path.resolve(__dirname, "../styles.css");
const htmlContent = fs.readFileSync(htmlPath, "utf8");
const cssContent = fs.readFileSync(cssPath, "utf8");

function loadAppMarkup(): void {
  document.documentElement.innerHTML = htmlContent;
  const style = document.createElement("style");
  style.textContent = cssContent;
  document.head.appendChild(style);
}

function mockEditor(): void {
  jest.doMock("@editorjs/editorjs", () => {
    return {
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        render: jest.fn(() => Promise.resolve()),
        save: jest.fn(() => Promise.resolve({ blocks: [] }))
      }))
    };
  });
}

async function bootstrapApp(): Promise<void> {
  const app = await import("../app");
  await app.bootstrap();
}

describe("bootstrap state restoration", () => {
  beforeEach(() => {
    jest.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    loadAppMarkup();
    localStorage.clear();
    mockEditor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("restores compact desktop layout on load", async () => {
    const snapshot: ChromnotesState = {
      ...defaultState,
      compactView: true,
      viewMode: "desktop",
      notes: [],
      categoryIndex: {}
    };

    localStorage.setItem(STORAGE_FALLBACK_KEY, JSON.stringify(snapshot));

    const appModule = await import("../app");
    await appModule.bootstrap();
    const stateModule = await import("../state");
    expect(stateModule.getState().compactView).toBe(true);
    expect(stateModule.getState().viewMode).toBe("desktop");

    expect(document.body.dataset.layout).toBe("desktop");
    expect(document.body.classList.contains("compact-list")).toBe(true);
    const modal = document.getElementById("noteModal");
    expect(modal?.classList.contains("modal--maximized")).toBe(true);

    const editor = document.getElementById("noteContent");
    const editorStyles = window.getComputedStyle(editor!);
    expect(editorStyles.overflowX).toBe("visible");
  });

  test("persists compact desktop preferences through a reload", async () => {
    await bootstrapApp();

    const compactToggle = document.getElementById("compactToggle") as HTMLInputElement;
    compactToggle.checked = true;
    compactToggle.dispatchEvent(new Event("change", { bubbles: true }));

    const desktopRadio = document.querySelector(
      'input[name="layoutChoice"][value="desktop"]'
    ) as HTMLInputElement;
    desktopRadio.checked = true;
    desktopRadio.dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = localStorage.getItem(STORAGE_FALLBACK_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(String(stored)) as ChromnotesState;
    expect(parsed.compactView).toBe(true);
    expect(parsed.viewMode).toBe("desktop");
    jest.resetModules();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    loadAppMarkup();
    mockEditor();

    const reloadedApp = await import("../app");
    await reloadedApp.bootstrap();
    const stateModule = await import("../state");
    expect(stateModule.getState().compactView).toBe(true);
    expect(stateModule.getState().viewMode).toBe("desktop");

    expect(document.body.dataset.layout).toBe("desktop");
    expect(document.body.classList.contains("compact-list")).toBe(true);
    const editor = document.getElementById("noteContent");
    const editorStyles = window.getComputedStyle(editor!);
    expect(editorStyles.overflowX).toBe("visible");
  });

  test("exports notes from settings panel", async () => {
    await bootstrapApp();

    const stateModule = await import("../state");
    stateModule.updateState({
      notes: [
        {
          id: "note-1",
          title: "Export me",
          content: "Some content",
          contentRaw: null,
          createdAt: 1,
          updatedAt: 2,
          category: "General"
        }
      ]
    });

    const settingsButton = document.getElementById("settingsButton") as HTMLButtonElement;
    const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;
    const settingsOverlay = document.getElementById("settingsOverlay") as HTMLDivElement;
    settingsButton.click();
    expect(settingsPanel.classList.contains("hidden")).toBe(false);
    expect(settingsOverlay.classList.contains("hidden")).toBe(false);
    expect(document.body.classList.contains("settings-modal-open")).toBe(true);
    const dataTabButton = document.querySelector('[data-settings-tab="data"]') as HTMLButtonElement;
    dataTabButton.click();
    const dataTabPanel = document.querySelector('[data-settings-panel="data"]') as HTMLElement;
    expect(dataTabPanel.classList.contains("is-active")).toBe(true);

    const mutableURL = URL as typeof URL & {
      createObjectURL?: (blob: Blob) => string;
    };
    const originalCreate = mutableURL.createObjectURL;
    Reflect.deleteProperty(mutableURL, "createObjectURL");

    jest.useFakeTimers();
    const windowWithRAF = window as typeof window & {
      requestAnimationFrame?: typeof window.requestAnimationFrame;
    };
    const originalRAF = windowWithRAF.requestAnimationFrame;
    Reflect.deleteProperty(windowWithRAF, "requestAnimationFrame");

    const exportButton = document.getElementById("exportNotesButton") as HTMLButtonElement;

    try {
      exportButton.click();

      const downloadAnchor = document.querySelector(
        'a[download^="chromnotes-notes-"]'
      ) as HTMLAnchorElement | null;

      expect(downloadAnchor).not.toBeNull();
      expect(downloadAnchor?.rel).toBe("noopener");
      expect(downloadAnchor?.href.startsWith("data:text/plain;charset=utf-8,")).toBe(true);
      const [, encoded = ""] = (downloadAnchor?.href ?? "").split(",", 2);
      const decoded = decodeURIComponent(encoded);
      expect(decoded).toContain('"title": "Export me"');
      expect(decoded.trim().startsWith("[")).toBe(true);
      expect(settingsPanel.classList.contains("hidden")).toBe(false);
      expect(settingsOverlay.classList.contains("hidden")).toBe(false);
      expect(document.body.classList.contains("settings-modal-open")).toBe(true);

      jest.runOnlyPendingTimers();
      expect(downloadAnchor && document.body.contains(downloadAnchor)).toBe(false);

      const importInput = document.getElementById("importNotesInput") as HTMLInputElement;
      const importStatus = document.getElementById("importNotesStatus") as HTMLParagraphElement;
      const importPayload = JSON.stringify(
        [
          {
            id: "import-1",
            title: "Imported note",
            content: "Hello from import",
            contentRaw: null,
            createdAt: 5,
            updatedAt: 5,
            category: "General"
          }
        ],
        null,
        2
      );
      const importFile = {
        text: () => Promise.resolve(importPayload)
      } as unknown as File;
      Object.defineProperty(importInput, "files", {
        value: [importFile],
        configurable: true
      });
      importInput.dispatchEvent(new Event("change", { bubbles: true }));

      await Promise.resolve();
      await Promise.resolve();

      const stateModule = await import("../state");
      expect(stateModule.getState().notes.some((note) => note.id === "import-1")).toBe(true);
      expect(importStatus.textContent).toContain("Imported 1 note");

      jest.advanceTimersByTime(5000);
      expect(importStatus.textContent).toBe("");
    } finally {
      jest.useRealTimers();
      if (originalCreate) {
        mutableURL.createObjectURL = originalCreate;
      } else {
        Reflect.deleteProperty(mutableURL, "createObjectURL");
      }
      if (originalRAF) {
        windowWithRAF.requestAnimationFrame = originalRAF;
      } else {
        Reflect.deleteProperty(windowWithRAF, "requestAnimationFrame");
      }
    }
  });
});
