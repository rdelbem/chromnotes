import type { OutputData } from "@editorjs/editorjs";
import fs from "node:fs";
import path from "node:path";

const htmlPath = path.resolve(__dirname, "../../index.html");
const cssPath = path.resolve(__dirname, "../styles.css");
const htmlContent = fs.readFileSync(htmlPath, "utf8");
const cssContent = fs.readFileSync(cssPath, "utf8");

type MockEditorOptions = {
  saveResult?: OutputData;
};

export function loadAppMarkup(): void {
  document.documentElement.innerHTML = htmlContent;
  const style = document.createElement("style");
  style.textContent = cssContent;
  document.head.appendChild(style);
}

export function mockEditor(options: MockEditorOptions = {}): void {
  jest.doMock("@editorjs/editorjs", () => {
    return {
      __esModule: true,
      default: jest.fn().mockImplementation((config: { onReady?: () => void }) => {
        config?.onReady?.();
        const saveMock =
          typeof options.saveResult !== "undefined"
            ? jest.fn(() => Promise.resolve(options.saveResult))
            : jest.fn(() => Promise.resolve({ blocks: [] }));
        return {
          render: jest.fn(() => Promise.resolve()),
          save: saveMock
        };
      })
    };
  });
}

export async function bootstrapApp(): Promise<void> {
  const app = await import("../app");
  await app.bootstrap();
}
