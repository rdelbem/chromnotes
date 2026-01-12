import EditorJS, {
  type API,
  type BlockMutationEvent,
  type EditorConfig,
  type OutputData,
  type ToolConstructable
} from "@editorjs/editorjs";
import Checklist from "@editorjs/checklist";
import Embed from "@editorjs/embed";
import ImageTool from "@editorjs/image";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import RawTool from "@editorjs/raw";
import SimpleImage from "@editorjs/simple-image";
import { contentEditor } from "./dom";

let editorInstance: EditorJS | null = null;
let editorReadyPromise: Promise<void> | null = null;
let resolveEditorReady: (() => void) | null = null;
let renderQueue: Promise<void> = Promise.resolve();
let cachedPlainText = "";
let cachedOutput: OutputData = { blocks: [{ type: "paragraph", data: { text: "" } }] };

const PLACEHOLDER = contentEditor.dataset.placeholder ?? "Write your thoughts here...";

type EditorUploadResult = {
  success: 1;
  file: {
    url: string;
    name?: string;
  };
};

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]).replace(/\n/g, "<br>");
}

function stripHtml(value: string): string {
  const withoutTags = value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function textToBlocks(value: string): OutputData {
  const normalized = value.replace(/\r?\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks = lines
    .map((line) => line.trim())
    .filter((line, index) => line.length > 0 || (index === 0 && lines.length === 1))
    .map((line) => ({
      type: "paragraph" as const,
      data: { text: escapeHtml(line) }
    }));

  if (!blocks.length) {
    blocks.push({ type: "paragraph", data: { text: "" } });
  }

  return { blocks };
}

function blocksToText(data: OutputData): string {
  if (!data?.blocks?.length) {
    return "";
  }
  return data.blocks
    .map((block) => {
      if (!block) return "";
      const payload = block.data as Record<string, unknown> | undefined;
      switch (block.type) {
        case "paragraph": {
          const text = typeof payload?.text === "string" ? payload.text : "";
          return stripHtml(text).trim();
        }
        case "quote": {
          const text = typeof payload?.text === "string" ? stripHtml(payload.text) : "";
          const caption = typeof payload?.caption === "string" ? stripHtml(payload.caption) : "";
          return [text, caption].filter(Boolean).join(" — ");
        }
        case "list": {
          const rawItems = Array.isArray(payload?.items)
            ? (payload as { items: unknown[] }).items
            : [];
          const items = rawItems
            .map((item) => (typeof item === "string" ? stripHtml(item) : ""))
            .filter(Boolean);
          return items.join("\n");
        }
        case "checklist": {
          const rawItems = Array.isArray(payload?.items)
            ? (payload as { items: unknown[] }).items
            : [];
          const items = rawItems.map((item) => {
            if (!item || typeof item !== "object") return "";
            const dataItem = item as { text?: string; checked?: boolean };
            const text = dataItem.text ? stripHtml(dataItem.text) : "";
            const marker = dataItem.checked ? "[x]" : "[ ]";
            return text ? `${marker} ${text}` : "";
          });
          return items.filter(Boolean).join("\n");
        }
        case "raw": {
          const html = typeof payload?.html === "string" ? payload.html : "";
          return stripHtml(html).trim();
        }
        case "image":
        case "simpleImage": {
          const caption = typeof payload?.caption === "string" ? stripHtml(payload.caption) : "";
          if (typeof payload?.url === "string") {
            return [caption, payload.url].filter(Boolean).join(" - ");
          }
          return caption;
        }
        case "embed": {
          const url = typeof payload?.url === "string" ? payload.url : "";
          const caption = typeof payload?.caption === "string" ? stripHtml(payload.caption) : "";
          return [caption, url].filter(Boolean).join(" - ");
        }
        default:
          return "";
      }
    })
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

function cloneOutputData(data: OutputData): OutputData {
  return {
    ...data,
    blocks: (data.blocks ?? []).map((block) => ({
      ...block,
      data:
        block.data && typeof block.data === "object"
          ? { ...(block.data as Record<string, unknown>) }
          : {}
    }))
  };
}

function ensureEditorReady(): Promise<void> {
  if (!editorInstance) {
    return Promise.resolve();
  }
  if (!editorReadyPromise) {
    editorReadyPromise = new Promise((resolve) => {
      resolveEditorReady = resolve;
    });
  }
  return editorReadyPromise;
}

function normalizeOutputData(data?: OutputData | null, fallbackText = ""): OutputData {
  if (data?.blocks?.length) {
    return cloneOutputData(data);
  }
  if (fallbackText.trim().length) {
    return textToBlocks(fallbackText);
  }
  return { blocks: [{ type: "paragraph", data: { text: "" } }] };
}

function updateCachedContent(data: OutputData): void {
  cachedOutput = cloneOutputData(data);
  cachedPlainText = blocksToText(cachedOutput);
}

export function getEditorValue(): string {
  return cachedPlainText;
}

export function getEditorData(): OutputData {
  return cloneOutputData(cachedOutput);
}

export async function refreshEditorCache(): Promise<void> {
  if (!editorInstance) {
    return;
  }
  const instance = editorInstance;
  try {
    await ensureEditorReady();
    const data = await instance.save();
    updateCachedContent(data);
  } catch (error) {
    console.warn("Chromnotes: failed to sync editor content.", error);
  }
}

export function setEditorContent(data?: OutputData | null, fallbackText = ""): void {
  const normalized = normalizeOutputData(data, fallbackText);
  updateCachedContent(normalized);

  if (!editorInstance) {
    return;
  }

  const instance = editorInstance;
  renderQueue = renderQueue
    .catch(() => {
      /* swallow previous errors to keep queue alive */
    })
    .then(() => ensureEditorReady())
    .then(() => {
      if (!instance) {
        return;
      }
      return instance.render(cloneOutputData(normalized));
    })
    .catch((error: unknown) => {
      console.warn("Chromnotes: failed to render editor content.", error);
    });
}

export function setEditorValue(value: string): void {
  setEditorContent(null, value);
}

export async function undoEditorChange(): Promise<void> {
  const undo = (editorInstance as unknown as { undo?: () => Promise<void> })?.undo;
  if (!editorInstance || !undo) return;
  await ensureEditorReady();
  await undo.call(editorInstance);
  await refreshEditorCache();
}

export async function redoEditorChange(): Promise<void> {
  const redo = (editorInstance as unknown as { redo?: () => Promise<void> })?.redo;
  if (!editorInstance || !redo) return;
  await ensureEditorReady();
  await redo.call(editorInstance);
  await refreshEditorCache();
}

export function initEditor(): void {
  if (editorInstance) {
    return;
  }

  editorReadyPromise = new Promise((resolve) => {
    resolveEditorReady = resolve;
  });

  editorInstance = new EditorJS({
    holder: contentEditor,
    minHeight: 0,
    placeholder: PLACEHOLDER,
    tools: buildToolsConfig(),
    autofocus: false,
    data: cloneOutputData(cachedOutput),
    onReady: () => {
      resolveEditorReady?.();
      resolveEditorReady = null;
    },
    onChange: (api: API, _event: BlockMutationEvent | BlockMutationEvent[]) => {
      void api.saver.save().then((data) => {
        updateCachedContent(data);
      });
    }
  });
}

function buildToolsConfig(): EditorConfig["tools"] {
  const uploadByFile = async (file: File): Promise<EditorUploadResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const reader = new FileReader();
    const url = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read image."));
      reader.readAsDataURL(blob);
    });

    if (!url) {
      throw new Error("Unable to generate image preview.");
    }

    return {
      success: 1,
      file: {
        url,
        name: file.name
      }
    } satisfies EditorUploadResult;
  };

  return {
    embed: {
      class: Embed as ToolConstructable,
      inlineToolbar: true
    },
    raw: RawTool as ToolConstructable,
    checklist: {
      class: Checklist as ToolConstructable,
      inlineToolbar: true
    },
    list: {
      class: List as ToolConstructable,
      inlineToolbar: true
    },
    quote: {
      class: Quote as ToolConstructable,
      inlineToolbar: true,
      config: {
        quotePlaceholder: "Enter a quote",
        captionPlaceholder: "Author or source"
      }
    },
    simpleImage: {
      class: SimpleImage as ToolConstructable,
      inlineToolbar: true
    },
    image: {
      class: ImageTool as ToolConstructable,
      inlineToolbar: true,
      config: {
        uploader: {
          uploadByFile
        }
      }
    }
  } satisfies EditorConfig["tools"];
}
