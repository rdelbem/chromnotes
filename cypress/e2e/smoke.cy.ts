describe("Chromnotes app", () => {
  const visitApp = () =>
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
      }
    });

  const createNote = (title: string, content: string, category: string) => {
    cy.get("#modalBackdrop").then(($backdrop) => {
      if (!$backdrop.hasClass("hidden")) {
        cy.get("#modalCancelButton").click();
        cy.get("#modalBackdrop").should("have.class", "hidden");
      }
    });

    cy.get("#newNoteButton").click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");
    cy.get("#noteTitle").clear().type(title);
    cy.get("#noteCategory").clear().type(category);
    cy.get("#noteContent .ce-paragraph", { timeout: 5000 })
      .first()
      .click()
      .type("{selectall}{backspace}")
      .type(content, { delay: 0 });

    cy.get("#modalSaveButton").click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");
    cy.get("#modalCancelButton").click();
    cy.get("#modalBackdrop").should("have.class", "hidden");
  };

  const openSettings = () => {
    cy.get("#settingsPanel").then(($panel) => {
      if ($panel.hasClass("hidden")) {
        cy.get("#settingsButton").click();
      }
    });
    cy.get("#settingsPanel").should("not.have.class", "hidden").and("be.visible");
  };

  const openSettingsTab = (tab: "appearance" | "layout" | "data" | "ai") => {
    openSettings();
    cy.get(`[data-settings-tab="${tab}"]`).click();
    cy.get(`[data-settings-panel="${tab}"]`).should("have.class", "is-active").and("be.visible");
  };

  beforeEach(() => {
    visitApp();
  });

  it("shows the New note button", () => {
    cy.get("#newNoteButton").should("exist").and("be.visible").and("contain.text", "New note");
  });

  it("creates a new note and displays it in the list", () => {
    const noteTitle = `Test note ${Date.now()}`;
    const noteContent = "Cypress can create notes!";

    createNote(noteTitle, noteContent, "Testing");

    cy.get("#notesContainer")
      .find(".note-card")
      .should("have.length.at.least", 1)
      .first()
      .should("contain.text", noteTitle);
    cy.get("#emptyState").should("have.attr", "hidden");
  });

  it("shows the newly created note in the list", () => {
    const noteTitle = `Displayed note ${Date.now()}`;
    const noteContent = "Displayed note content";

    cy.get("#notesContainer .note-card").should("have.length", 0);

    createNote(noteTitle, noteContent, "Display");

    cy.contains(".note-card", noteTitle)
      .should("exist")
      .and("be.visible")
      .within(() => {
        cy.contains(".note-category", "Display").should("exist");
        cy.contains(".note-preview", "Displayed note content").should("exist");
      });
  });

  it("deletes a selected note from the list", () => {
    const noteTitle = `Note to delete ${Date.now()}`;
    const noteContent = "This note will be removed";

    createNote(noteTitle, noteContent, "Cleanup");

    cy.contains(".note-card", noteTitle).should("exist");
    cy.contains(".note-card", noteTitle).click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");
    cy.get("#modalDeleteButton").should("not.be.disabled").click();

    cy.get("#modalBackdrop").should("have.class", "hidden");
    cy.contains(".note-card", noteTitle).should("not.exist");
    cy.get("#notesContainer .note-card").should("have.length", 0);
    cy.get("#emptyState").should("be.visible").invoke("text").should("contain", "No notes yet");
  });

  it("paginates when more than 10 notes are created", () => {
    const totalNotes = 20;

    for (let index = 1; index <= totalNotes; index += 1) {
      createNote(`Paginated Note ${index}`, `Content ${index}`, `Category ${index % 3}`);
    }

    cy.get("#notesContainer .note-card").should("have.length", 10);
    cy.get("#paginationControls").should("be.visible");
    cy.get("#paginationStatus").should("contain.text", "Page 1 of 2");
    cy.contains(".note-card", "Paginated Note 20").should("exist");

    cy.get("#nextPageButton").should("not.be.disabled").click();

    cy.get("#paginationStatus").should("contain.text", "Page 2 of 2");
    cy.contains(".note-card", "Paginated Note 1").should("exist");
    cy.get("#prevPageButton").should("not.be.disabled");
  });

  it("filters notes by search term", () => {
    createNote("Search Alpha", "Find me easily", "Search");
    createNote("Search Beta", "Another searchable entry", "Search");
    createNote("Unrelated", "This should be filtered out", "Other");

    cy.get("#searchInput").type("Beta");

    cy.get("#notesContainer .note-card")
      .should("have.length", 1)
      .first()
      .should("contain.text", "Search Beta");

    cy.get("#emptyState").should("have.attr", "hidden");
  });

  it("toggles between dark and light themes", () => {
    openSettings();
    cy.get("body").should("have.attr", "data-theme", "dark");
    cy.get("#themeToggle").should("be.checked");

    cy.get("#themeToggle").uncheck({ force: true });
    cy.get("body").should("have.attr", "data-theme", "light");

    cy.get("#themeToggle").check({ force: true });
    cy.get("body").should("have.attr", "data-theme", "dark");
  });

  it("applies a selected theme option from the palette", () => {
    openSettings();
    cy.get('input[name="themeChoice"][value="dracula"]').check({ force: true });
    cy.get("body").should("have.attr", "data-theme", "dracula");

    openSettings();
    cy.get('input[name="themeChoice"][value="dark"]').check({ force: true });
    cy.get("body").should("have.attr", "data-theme", "dark");
  });

  it("toggles compact view for the notes list", () => {
    openSettings();
    cy.get("#compactToggle").should("not.be.checked");
    cy.get("body").should("not.have.class", "compact-list");
    cy.get("#notesContainer").should("not.have.class", "compact");

    cy.get("#compactToggle").check({ force: true });
    cy.get("body").should("have.class", "compact-list");
    cy.get("#notesContainer").should("have.class", "compact");

    cy.get("#compactToggle").uncheck({ force: true });
    cy.get("body").should("not.have.class", "compact-list");
    cy.get("#notesContainer").should("not.have.class", "compact");
  });

  it("switches between list and desktop layouts", () => {
    openSettings();
    cy.get("body").should("have.attr", "data-layout", "list");
    cy.get('input[name="layoutChoice"][value="desktop"]').check({ force: true });

    cy.get("body").should("have.attr", "data-layout", "desktop");
    cy.get("#modalBackdrop").should("not.have.class", "hidden");

    openSettings();
    cy.get('input[name="layoutChoice"][value="list"]').check({ force: true });

    cy.get("body").should("have.attr", "data-layout", "list");
    cy.get("#modalBackdrop").should("have.class", "hidden");
  });

  it("maximizes and restores the note editor in list view", () => {
    cy.get("body").should("have.attr", "data-layout", "list");
    createNote("Maximize Test", "Testing maximize behavior", "Layout");

    cy.contains(".note-card", "Maximize Test").click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");
    cy.get("#noteModal").should("not.have.class", "modal--maximized");

    cy.get("#modalMaximizeButton")
      .should("be.visible")
      .and("have.attr", "aria-label", "Maximize note editor")
      .click();

    cy.get("#noteModal").should("have.class", "modal--maximized");
    cy.get("#modalMaximizeButton").should("have.attr", "aria-label", "Restore note editor size");

    cy.get("#modalMaximizeButton").click();
    cy.get("#noteModal").should("not.have.class", "modal--maximized");
    cy.get("#modalMaximizeButton").should("have.attr", "aria-label", "Maximize note editor");

    cy.get("#modalCancelButton").click();
    cy.get("#modalBackdrop").should("have.class", "hidden");
  });

  it("exports notes via the settings data tab", () => {
    const noteTitle = `Exportable ${Date.now()}`;
    createNote(noteTitle, "Content for export", "Data");

    openSettingsTab("data");

    cy.window().then((win) => {
      cy.stub(win.URL, "createObjectURL")
        .as("createObjectURL")
        .callsFake((blob: Blob) => {
          void blob.text().then((text) => {
            expect(text).to.include(noteTitle);
          });
          return "blob:stubbed";
        });
      cy.stub(win.URL, "revokeObjectURL").as("revokeObjectURL");
    });

    cy.get("#exportNotesButton").click();

    cy.get("@createObjectURL").should("have.been.calledOnce");
    cy.get("@revokeObjectURL").should("have.been.calledOnceWith", "blob:stubbed");
    cy.get("#settingsPanel").should("not.have.class", "hidden");
    cy.get("#settingsOverlay")
      .should("not.have.class", "hidden")
      .and("have.attr", "role", "presentation");
  });

  it("imports notes via the settings data tab", () => {
    openSettingsTab("data");

    const timestamp = Date.now();
    const importPayload = JSON.stringify(
      [
        {
          id: `import-${timestamp}`,
          title: "Imported Cypress Note",
          content: "This note came from a file.",
          contentRaw: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          category: "Imports"
        }
      ],
      null,
      2
    );

    cy.get("#importNotesInput").selectFile(
      {
        contents: Cypress.Buffer.from(importPayload),
        fileName: "chromnotes-notes.txt",
        mimeType: "text/plain",
        lastModified: timestamp
      },
      { force: true }
    );

    cy.get("#importNotesStatus").should("contain.text", "Imported 1 note");
    cy.contains(".note-card", "Imported Cypress Note").should("exist").and("be.visible");
    cy.contains(".note-card", "Imported Cypress Note")
      .find(".note-category")
      .should("contain.text", "Imports");
  });

  it("merges related notes through the AI brain using stubbed OpenAI responses", () => {
    const firstTitle = "AI Research Plan";
    const secondTitle = "AI Research Findings";

    createNote(firstTitle, "Outline about AI", "AI");
    createNote(secondTitle, "More AI research details", "AI");

    let noteIds = { first: "", second: "" };
    cy.window().then((win) => {
      const payload = JSON.parse(win.localStorage.getItem("chromnotes_state") ?? "{}");
      expect(payload.notes).to.have.length(2);
      noteIds = { first: payload.notes[0].id, second: payload.notes[1].id };
    });

    cy.then(() => {
      let callCount = 0;
      cy.intercept("POST", "https://api.openai.com/v1/chat/completions", (req) => {
        callCount += 1;
        if (callCount === 1) {
          req.reply({
            statusCode: 200,
            body: {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      summary: "AI brain found overlap with AI Research Findings.",
                      similarNoteIds: [noteIds.second]
                    })
                  }
                }
              ]
            }
          });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      title: "AI Research Hub",
                      category: "AI Collab",
                      content: "Merged insights from both notes.",
                      summary: "AI merged the related notes into one."
                    })
                  }
                }
              ]
            }
          });
        }
      }).as("openAi");
    });

    openSettingsTab("ai");
    cy.get("#aiApiKeyInput").clear().type("sk-test");
    cy.get("#aiApiKeySaveButton").click();
    cy.get("#aiApiKeyStatus").should("contain.text", "saved");
    cy.get("#settingsCloseButton").click();
    cy.get("#settingsPanel").should("have.class", "hidden");

    cy.contains(".note-card", firstTitle).click();
    cy.get("#modalOrganizeButton").should("not.be.disabled").click();
    cy.wait("@openAi");

    cy.get("#noteAssistantBanner").should("be.visible").and("contain.text", "overlap");
    cy.get("#noteAssistantMergeButton").should("be.visible").and("not.be.disabled").click();
    cy.wait("@openAi");

    cy.contains(".note-card", "AI Research Hub").should("exist");
    cy.contains(".note-card", firstTitle).should("not.exist");
    cy.contains(".note-card", secondTitle).should("not.exist");
    cy.get(".note-card").should("have.length", 1);
    cy.get("#noteAssistantBanner").should("contain.text", "AI merged the related notes into one.");
  });

  it("copies the current note to the clipboard via the copy button", () => {
    const noteTitle = "Clipboard Note";
    const noteContent = "Clipboard body text";
    createNote(noteTitle, noteContent, "Clipboard");

    cy.contains(".note-card", noteTitle).click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");

    cy.window().then((win) => {
      if (!win.navigator.clipboard) {
        // @ts-expect-error - injecting mock clipboard for test
        win.navigator.clipboard = {} as Clipboard;
      }
      cy.stub(win.navigator.clipboard, "writeText").as("writeText").resolves();
    });

    cy.get("#modalCopyButton").click();
    cy.get("@writeText").should("have.been.calledWith", `${noteTitle}\n\n${noteContent}`);
  });

  it("supports undo and redo for recent changes", () => {
    const noteTitle = "Undoable Note";
    const noteContent = "Undoable content";
    createNote(noteTitle, noteContent, "History");

    cy.contains(".note-card", noteTitle).click();
    cy.get("#modalBackdrop").should("not.have.class", "hidden");

    cy.clock();
    cy.get("#noteTitle").clear().type("Updated Title");
    cy.tick(2100); // allow history snapshot to flush (2s delay)

    cy.get("#modalUndoButton").click();
    cy.get("#noteTitle").should("have.value", noteTitle);

    cy.get("#modalRedoButton").click();
    cy.get("#noteTitle").should("have.value", "Updated Title");
  });
});
