import type { API, BlockMutationEvent, EditorConfig, OutputData } from "@editorjs/editorjs";

describe("editor utilities", () => {
  let editorModule: typeof import("../editor");
  let editorElement: HTMLDivElement;
  let editorConstructorMock: jest.Mock;
  let renderMock: jest.Mock<Promise<void>, [OutputData]>;
  let saveMock: jest.Mock<Promise<OutputData>, []>;
  let latestConfig: EditorConfig | null;
  let storedData: OutputData;

  const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

  const setupModule = async (): Promise<void> => {
    jest.resetModules();
    editorElement = document.createElement("div");
    editorElement.dataset.placeholder = "Write something";

    renderMock = jest.fn<Promise<void>, [OutputData]>((data) => {
      storedData = data;
      return Promise.resolve();
    });
    storedData = { blocks: [] };
    latestConfig = null;
    saveMock = jest.fn(() => Promise.resolve(storedData));

    jest.doMock("../dom", () => ({
      __esModule: true,
      contentEditor: editorElement
    }));

    jest.doMock("@editorjs/editorjs", () => {
      editorConstructorMock = jest.fn((config: EditorConfig) => {
        latestConfig = config;
        if (config.data) {
          storedData = config.data;
        }
        if (typeof config.onReady === "function") {
          config.onReady();
        }
        return {
          render: renderMock,
          save: saveMock
        };
      });
      return { __esModule: true, default: editorConstructorMock };
    });

    editorModule = await import("../editor");
  };

  beforeEach(async () => {
    await setupModule();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("setEditorValue normalizes newline characters", () => {
    editorModule.setEditorValue("Hello\r\nWorld  ");
    expect(editorModule.getEditorValue()).toBe("Hello\nWorld");
  });

  test("initEditor bootstraps Editor.js with cached content", () => {
    editorModule.setEditorValue("Persistent text");
    editorModule.initEditor();

    expect(editorConstructorMock).toHaveBeenCalledTimes(1);
    const config = editorConstructorMock.mock.calls[0][0] as EditorConfig;
    expect(config.holder).toBe(editorElement);
    expect(config.placeholder).toBe("Write something");
    expect(config.data?.blocks?.[0]?.data?.text).toContain("Persistent text");
    expect(Object.keys(config.tools ?? {})).toEqual(
      expect.arrayContaining(["embed", "raw", "checklist", "list", "quote", "simpleImage", "image"])
    );
  });

  test("setEditorValue renders content once editor is ready", async () => {
    editorModule.initEditor();
    renderMock.mockClear();

    editorModule.setEditorValue("Updated content");
    await flushAsync();

    expect(renderMock).toHaveBeenCalledTimes(1);
    const renderArg = renderMock.mock.calls[0][0];
    expect(renderArg.blocks[0].data.text).toContain("Updated content");
  });

  test("editor change updates cached plain text", async () => {
    editorModule.initEditor();
    storedData = {
      blocks: [
        { type: "list", data: { items: ["<b>First item</b>", "Second item"] } },
        {
          type: "checklist",
          data: {
            items: [
              { text: "Task A", checked: true },
              { text: "Task B", checked: false }
            ]
          }
        }
      ]
    };

    const onChange = latestConfig?.onChange as
      | ((api: API, event: BlockMutationEvent | BlockMutationEvent[]) => void)
      | undefined;
    const saver = { save: jest.fn(() => Promise.resolve(storedData)) };
    onChange?.({ saver } as unknown as API, [] as BlockMutationEvent[]);
    await flushAsync();

    expect(editorModule.getEditorValue()).toBe("First item\nSecond item\n[x] Task A\n[ ] Task B");
  });

  test("setEditorContent normalizes complex blocks into plain text", () => {
    const complex: OutputData = {
      blocks: [
        { type: "paragraph", data: { text: "Hello&nbsp;<b>World</b><br>line" } },
        {
          type: "quote",
          data: { text: "<i>Quote</i>", caption: "<strong>Author</strong>" }
        },
        {
          type: "list",
          data: { items: ["<span>Item 1</span>", "Item &amp; 2"] }
        },
        {
          type: "checklist",
          data: {
            items: [
              { text: "<b>Task</b> A", checked: true },
              { text: "Task B", checked: false }
            ]
          }
        },
        { type: "raw", data: { html: "<div>Raw &lt;html&gt;</div>" } },
        { type: "simpleImage", data: { caption: "<b>Caption</b>", url: "http://img" } },
        { type: "image", data: { caption: "Image caption", url: "http://img2" } },
        { type: "embed", data: { caption: "Embed caption", url: "http://video" } },
        { type: "unknown" as const, data: {} }
      ]
    };

    editorModule.setEditorContent(complex);
    expect(editorModule.getEditorValue()).toBe(
      [
        "Hello World",
        "line",
        "Quote — Author",
        "Item 1",
        "Item & 2",
        "[x] Task A",
        "[ ] Task B",
        "Raw <html>",
        "Caption - http://img",
        "Image caption - http://img2",
        "Embed caption - http://video"
      ].join("\n")
    );
  });

  test("setEditorContent falls back to plain text when output data is empty", () => {
    editorModule.setEditorContent({ blocks: [] }, "Hello world");
    expect(editorModule.getEditorValue()).toBe("Hello world");
  });

  test("refreshEditorCache warns when editor save fails", async () => {
    editorModule.initEditor();
    await flushAsync();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    saveMock.mockRejectedValueOnce(new Error("Save failed"));
    await editorModule.refreshEditorCache();
    expect(warnSpy).toHaveBeenCalledWith(
      "Chromnotes: failed to sync editor content.",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  test("setEditorContent handles render failures and continues rendering", async () => {
    editorModule.initEditor();
    await flushAsync();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    renderMock.mockRejectedValueOnce(new Error("render failed"));
    editorModule.setEditorContent({
      blocks: [{ type: "paragraph", data: { text: "First" } }]
    });
    await flushAsync();
    renderMock.mockResolvedValueOnce(Promise.resolve());
    editorModule.setEditorContent({
      blocks: [{ type: "paragraph", data: { text: "Second" } }]
    });
    await flushAsync();
    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Chromnotes: failed to render editor content.",
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });

  test("buildToolsConfig uploader resolves and rejects correctly", async () => {
    editorModule.initEditor();
    await flushAsync();
    const tools = latestConfig?.tools;
    const uploader = (
      tools?.image as {
        config: { uploader: { uploadByFile: (file: File) => Promise<unknown> } };
      }
    )?.config.uploader;
    if (!uploader) {
      throw new Error("Uploader config missing");
    }

    const originalFileReader = global.FileReader;
    type MockFileReaderCtor = new () => {
      result: string | ArrayBuffer | null;
      onload: null | (() => void);
      onerror: null | (() => void);
      readAsDataURL: () => void;
      error?: unknown;
    };
    const setMockFileReader = (ctor: MockFileReaderCtor): void => {
      (globalThis as unknown as { FileReader: unknown }).FileReader = ctor as unknown;
    };

    class SuccessfulFileReader {
      public result: string | ArrayBuffer | null = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;
      readAsDataURL(): void {
        this.result = "data:image/png;base64,AAAA";
        this.onload?.();
      }
    }

    setMockFileReader(SuccessfulFileReader);

    const file = {
      name: "photo.png",
      type: "image/png",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1]).buffer)
    } as unknown as File;

    const success = await uploader.uploadByFile(file);
    expect(success).toEqual({
      success: 1,
      file: { url: "data:image/png;base64,AAAA", name: "photo.png" }
    });

    class FailingFileReader {
      public result: string | ArrayBuffer | null = null;
      public error: unknown = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;
      readAsDataURL(): void {
        this.error = new Error("reader error");
        this.onerror?.();
      }
    }
    setMockFileReader(FailingFileReader);

    await expect(uploader.uploadByFile(file)).rejects.toEqual(new Error("reader error"));

    class EmptyFileReader {
      public result: string | ArrayBuffer | null = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;
      readAsDataURL(): void {
        this.result = "";
        this.onload?.();
      }
    }
    setMockFileReader(EmptyFileReader);

    await expect(uploader.uploadByFile(file)).rejects.toThrow("Unable to generate image preview.");

    (globalThis as unknown as { FileReader: typeof FileReader }).FileReader = originalFileReader;
  });
});
