import { requestMergedNote, requestNoteOrganization } from "../services/ai";
import { Note } from "../types";

describe("AI services", () => {
  const baseNote: Note = {
    id: "a",
    title: "Alpha",
    category: "Work",
    content: "Research about AI",
    contentRaw: null,
    createdAt: 1,
    updatedAt: 1
  };

  const relatedNote: Note = {
    ...baseNote,
    id: "b",
    title: "Beta",
    content: "Similar research",
    updatedAt: 2
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // @ts-expect-error: cleanup mock
    delete global.fetch;
  });

  test("requestNoteOrganization returns summary and filtered IDs", async () => {
    const apiKey = "sk-test";

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ summary: "There is note Beta", similarNoteIds: ["b"] })
            }
          }
        ]
      })
    });

    const result = await requestNoteOrganization({
      apiKey,
      current: baseNote,
      notes: [baseNote, relatedNote]
    });

    expect(result).toEqual({ summary: "There is note Beta", similarNoteIds: ["b"] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init?.method).toBe("POST");
    const payload = JSON.parse(init?.body as string);
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.response_format?.json_schema?.name).toBe("note_organizer_result");
  });

  test("requestMergedNote prefers AI provided fields and falls back when missing", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Merged Research",
                category: "AI",
                content: "Combined content",
                summary: "Merged two notes"
              })
            }
          }
        ]
      })
    });

    const result = await requestMergedNote({
      apiKey: "sk-test",
      notes: [baseNote, relatedNote]
    });

    expect(result).toEqual({
      title: "Merged Research",
      category: "AI",
      content: "Combined content",
      summary: "Merged two notes"
    });
  });
});
