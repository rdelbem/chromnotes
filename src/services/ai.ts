import { Note } from "../types";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const ORGANIZER_MODEL = "gpt-4o-mini";
const MAX_NOTES_IN_CONTEXT = 25;
const MAX_CONTENT_LENGTH = 500;

export type OrganizerResult = {
  summary: string;
  similarNoteIds: string[];
};

export type MergeNoteResult = {
  title: string;
  category: string | null;
  content: string;
  summary: string;
};

function summarizeContent(content: string): string {
  if (!content) {
    return "(no content)";
  }
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_CONTENT_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_CONTENT_LENGTH)}…`;
}

function formatNotePayload(note: Note): string {
  const title = note.title?.trim().length ? note.title.trim() : "Untitled note";
  const category = note.category?.trim().length ? note.category.trim() : "Uncategorized";
  return `ID: ${note.id}\nTitle: ${title}\nCategory: ${category}\nContent: ${summarizeContent(note.content)}`;
}

async function callOpenAi<TResponse>(
  apiKey: string,
  body: Record<string, unknown>
): Promise<TResponse> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`OpenAI request failed: ${errorMessage}`);
  }

  type ChatCompletionResponse = {
    choices?: Array<{
      message?: {
        content?: string | null;
      } | null;
    }>;
  };

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI response missing content.");
  }
  return JSON.parse(content) as TResponse;
}

export async function requestNoteOrganization(options: {
  current: Note;
  notes: Note[];
  apiKey: string;
}): Promise<OrganizerResult> {
  const { current, notes, apiKey } = options;
  const otherNotes = notes
    .filter((note) => note.id !== current.id)
    .slice(0, MAX_NOTES_IN_CONTEXT)
    .map((note) => formatNotePayload(note))
    .join("\n---\n");

  const systemPrompt =
    "You are the Chromnotes AI brain. You analyze a current note and determine if any other notes (identified by ID) cover the same subject.";

  const userPrompt = `Current note:\n${formatNotePayload(current)}\n\nOther notes:\n${
    otherNotes || "(no other notes provided)"
  }\n\nInstructions:\n- Return JSON with fields "summary" (string under 80 words) and "similarNoteIds" (array of IDs from the provided notes).\n- Only include IDs you are confident refer to the same subject as the current note.\n- If there are no related notes, use an empty array.`;

  const response = await callOpenAi<{ summary?: unknown; similarNoteIds?: unknown[] }>(apiKey, {
    model: ORGANIZER_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "note_organizer_result",
        schema: {
          type: "object",
          required: ["summary", "similarNoteIds"],
          properties: {
            summary: { type: "string" },
            similarNoteIds: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return {
    summary: typeof response.summary === "string" ? response.summary : "",
    similarNoteIds: Array.isArray(response.similarNoteIds)
      ? response.similarNoteIds.filter((id: unknown): id is string => typeof id === "string")
      : []
  };
}

export async function requestMergedNote(options: {
  apiKey: string;
  notes: Note[];
}): Promise<MergeNoteResult> {
  const { apiKey, notes } = options;
  const notesPayload = notes
    .map((note, index) => `Note ${index + 1}\n${formatNotePayload(note)}`)
    .join("\n---\n");

  const systemPrompt =
    "You merge multiple Chromnotes entries into a single concise note. When helpful, you may invent a clearer category name based on the content.";

  const userPrompt = `Merge the following notes into a single cohesive note.\n${notesPayload}\n\nReturn JSON with fields: title (string), category (string or null), content (multi-line string), and summary (short explanation of what changed). Make the content friendly for a plain text note.`;

  const response = await callOpenAi<{
    title?: unknown;
    category?: unknown;
    content?: unknown;
    summary?: unknown;
  }>(apiKey, {
    model: ORGANIZER_MODEL,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "note_merge_result",
        schema: {
          type: "object",
          required: ["title", "category", "content", "summary"],
          properties: {
            title: { type: "string" },
            category: { type: ["string", "null"] },
            content: { type: "string" },
            summary: { type: "string" }
          }
        }
      }
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return {
    title:
      typeof response.title === "string" && response.title.trim().length
        ? response.title.trim()
        : "Merged note",
    category:
      typeof response.category === "string" && response.category.trim().length
        ? response.category.trim()
        : null,
    content: typeof response.content === "string" ? response.content : "",
    summary:
      typeof response.summary === "string" ? response.summary : "Merged these notes with AI brain."
  };
}
