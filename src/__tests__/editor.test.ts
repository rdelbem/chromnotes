import type { API, BlockMutationEvent, EditorConfig, OutputData } from "@editorjs/editorjs";

describe("editor utilities", () => {
  let editorModule: typeof import("../editor");
  let editorElement: HTMLDivElement;
  let editorConstructorMock: jest.Mock;
  let renderMock: jest.Mock<Promise<void>, [OutputData]>;
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
          save: jest.fn(() => Promise.resolve(storedData))
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
});
