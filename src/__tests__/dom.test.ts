function renderDom(
  options: {
    includeThemeChoices?: boolean;
    includeLayoutChoices?: boolean;
    includeAppearanceChoices?: boolean;
  } = {}
): void {
  const {
    includeThemeChoices = true,
    includeLayoutChoices = true,
    includeAppearanceChoices = true
  } = options;
  const themeChoices = includeThemeChoices
    ? `
        <label>
          <input type="radio" name="themeChoice" value="light" />
          <span>Light</span>
        </label>
        <label>
          <input type="radio" name="themeChoice" value="dark" />
          <span>Dark</span>
        </label>
      `
    : "";

  const layoutChoices = includeLayoutChoices
    ? `
        <label>
          <input type="radio" name="layoutChoice" value="list" />
          <span>List</span>
        </label>
        <label>
          <input type="radio" name="layoutChoice" value="desktop" />
          <span>Desktop</span>
        </label>
      `
    : "";

  const appearanceChoices = includeAppearanceChoices
    ? `
        <label>
          <input type="radio" name="appearanceThemeChoice" value="classic" />
          <span>Classic</span>
        </label>
        <label>
          <input type="radio" name="appearanceThemeChoice" value="windup" />
          <span>Windup</span>
        </label>
      `
    : "";

  document.body.innerHTML = `
    <header>
      <button id="settingsButton" type="button"></button>
      <div id="headerSearchSlot"></div>
    </header>
    <form id="noteForm">
      <input id="noteTitle" />
      <input id="noteCategory" />
      <div id="noteContent"></div>
      <input id="noteId" />
    </form>
    <ul id="notesContainer"></ul>
    <p id="emptyState"></p>
    <div id="listSearchHome">
      <div id="searchFieldWrapper">
        <input id="searchInput" />
      </div>
    </div>
    <select id="categoryFilter"></select>
    <input id="themeToggle" type="checkbox" />
    <button id="newNoteButton" type="button"></button>
    <div id="modalBackdrop" class="hidden">
      <div id="noteModal">
        <button id="modalMaximizeButton" type="button"></button>
        <button id="modalDeleteButton" type="button"></button>
        <button id="modalOrganizeButton" type="button"></button>
        <button id="modalCancelButton" type="button"></button>
        <button id="modalSaveButton" type="button"></button>
        <div id="noteAssistantBanner">
          <div>
            <p id="noteAssistantText"></p>
            <button id="noteAssistantMergeButton" type="button"></button>
          </div>
          <button id="noteAssistantDismissButton" type="button"></button>
        </div>
      </div>
    </div>
    <div id="settingsPanel" hidden>
      <button id="settingsCloseButton" type="button"></button>
      <div>
        <button data-settings-tab="palettes" type="button"></button>
        <button data-settings-tab="themes" type="button"></button>
        <button data-settings-tab="layout" type="button"></button>
        <button data-settings-tab="ai" type="button"></button>
      </div>
      <section data-settings-panel="palettes">
        ${themeChoices}
      </section>
      <section data-settings-panel="themes">
        ${appearanceChoices}
      </section>
      <section data-settings-panel="layout">
        ${layoutChoices}
      </section>
      <section data-settings-panel="ai"></section>
    </div>
    <div id="settingsOverlay"></div>
    <nav id="paginationControls">
      <button id="prevPageButton" type="button"></button>
      <span id="paginationStatus"></span>
      <button id="nextPageButton" type="button"></button>
    </nav>
    <input id="compactToggle" type="checkbox" />
    <input id="syncToggle" type="checkbox" />
    <button id="exportNotesButton" type="button"></button>
    <input id="importNotesInput" type="file" />
    <p id="importNotesStatus"></p>
    <input id="aiApiKeyInput" />
    <button id="aiApiKeySaveButton" type="button"></button>
    <button id="aiApiKeyClearButton" type="button"></button>
    <p id="aiApiKeyStatus"></p>
  `;
}

describe("dom bindings", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  test("exports references to required DOM elements", async () => {
    renderDom();
    const domModule = await import("../dom");

    expect(domModule.form.id).toBe("noteForm");
    expect(domModule.titleInput.id).toBe("noteTitle");
    expect(domModule.themeChoiceInputs).toHaveLength(2);
    expect(domModule.layoutChoiceInputs).toHaveLength(2);
    expect(domModule.appearanceThemeChoiceInputs).toHaveLength(2);
  });

  test("throws descriptive error when required element is missing", async () => {
    renderDom();
    const domModule = await import("../dom");
    expect(() => domModule.requireElement("missing")).toThrow(
      'Chromnotes: missing required element with id "missing".'
    );
  });

  test("throws when theme options are not present", async () => {
    renderDom({ includeThemeChoices: false });
    await expect(import("../dom")).rejects.toThrow("Chromnotes: missing theme choice inputs.");
  });

  test("throws when layout options are not present", async () => {
    renderDom({ includeLayoutChoices: false });
    await expect(import("../dom")).rejects.toThrow("Chromnotes: missing layout choice inputs.");
  });

  test("throws when appearance theme options are not present", async () => {
    renderDom({ includeAppearanceChoices: false });
    await expect(import("../dom")).rejects.toThrow(
      "Chromnotes: missing appearance theme choice inputs."
    );
  });
});
