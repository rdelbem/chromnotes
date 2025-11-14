import fs from "node:fs";
import path from "node:path";

describe("layout styles", () => {
  let styleElement: HTMLStyleElement;

  beforeAll(() => {
    const cssPath = path.resolve(__dirname, "../styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");
    styleElement = document.createElement("style");
    styleElement.textContent = cssContent;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement.remove();
  });

  afterEach(() => {
    document.body.className = "";
    document.body.dataset.layout = "";
    document.body.innerHTML = "";
  });

  test("desktop compact layout keeps editor toolbar overflow visible", () => {
    document.body.dataset.layout = "desktop";
    document.body.classList.add("compact-list");

    const modalBackdrop = document.createElement("div");
    modalBackdrop.id = "modalBackdrop";
    modalBackdrop.className = "modal-backdrop";

    const modal = document.createElement("div");
    modal.id = "noteModal";
    modal.className = "modal modal--maximized";
    modalBackdrop.appendChild(modal);

    const modalForm = document.createElement("form");
    modalForm.className = "modal-form";

    const fieldGrow = document.createElement("div");
    fieldGrow.className = "field field--grow";

    const editor = document.createElement("div");
    editor.id = "noteContent";
    editor.className = "editor";

    fieldGrow.appendChild(editor);
    modalForm.appendChild(fieldGrow);
    modal.appendChild(modalForm);
    document.body.appendChild(modalBackdrop);

    const editorStyles = window.getComputedStyle(editor);
    const modalFormStyles = window.getComputedStyle(modalForm);
    const modalStyles = window.getComputedStyle(modal);

    expect(editorStyles.overflowX).toBe("visible");
    expect(editorStyles.overflowY === "auto" || editorStyles.overflowY === "scroll").toBe(true);
    expect(modalFormStyles.overflowY === "" || modalFormStyles.overflowY === "visible").toBe(true);
    expect(modalFormStyles.overflowX === "" || modalFormStyles.overflowX === "visible").toBe(true);
    expect(modalStyles.overflowX === "" || modalStyles.overflowX === "visible").toBe(true);
  });
});
