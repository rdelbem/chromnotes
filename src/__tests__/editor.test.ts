describe("editor utilities", () => {
  let editorModule: typeof import("../editor");
  let editorElement: HTMLDivElement;

  const setupModule = async (): Promise<void> => {
    jest.resetModules();
    editorElement = document.createElement("div");
    editorElement.innerHTML = "";
    editorElement.innerText = "";

    jest.doMock("../dom", () => ({
      __esModule: true,
      contentEditor: editorElement
    }));

    editorModule = await import("../editor");
  };

  beforeEach(async () => {
    await setupModule();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("getEditorValue normalizes whitespace and preserves newlines", () => {
    editorElement.innerText = "Hello\r\nWorld  ";
    const value = editorModule.getEditorValue();
    expect(value).toBe("Hello\nWorld");
  });

  test("getEditorValue clears placeholder when empty", () => {
    editorElement.innerText = "\u00a0  ";
    editorElement.innerHTML = "<p><br></p>";
    const value = editorModule.getEditorValue();
    expect(value).toBe("");
    expect(editorElement.innerHTML).toBe("");
  });

  test("setEditorValue normalizes input and clears placeholder", () => {
    editorElement.innerHTML = "<span>should clear</span>";
    editorModule.setEditorValue("Line one\r\nLine two");
    expect(editorElement.innerText).toBe("Line one\nLine two");

    editorModule.setEditorValue("");
    expect(editorElement.innerHTML).toBe("");
  });

  test("initEditor wires paste handler that sanitizes clipboard text", () => {
    const execCommandSpy = jest.spyOn(document, "execCommand").mockImplementation(() => true);

    editorModule.initEditor();

    const clipboardData = { getData: jest.fn(() => "pasted text") };
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    const preventDefaultSpy = jest.spyOn(pasteEvent, "preventDefault");
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: clipboardData
    });

    editorElement.dispatchEvent(pasteEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(clipboardData.getData).toHaveBeenCalledWith("text/plain");
    expect(execCommandSpy).toHaveBeenCalledWith("insertText", false, "pasted text");
  });

  test("initEditor clears placeholder on input and blur", () => {
    editorElement.innerHTML = "<em>ignore</em>";
    editorModule.initEditor();

    editorElement.innerText = "   ";
    editorElement.dispatchEvent(new Event("input"));
    expect(editorElement.innerHTML).toBe("");

    editorElement.innerHTML = "<em>ignore</em>";
    editorElement.innerText = "\u00a0";
    editorElement.dispatchEvent(new Event("blur"));
    expect(editorElement.innerHTML).toBe("");
  });
});
