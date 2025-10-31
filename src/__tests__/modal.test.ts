describe("modal interactions", () => {
  let modalModule: typeof import("../modal");
  let modalElement: HTMLDivElement;
  let backdropElement: HTMLDivElement;
  let maximizeButton: HTMLButtonElement;
  let titleInput: HTMLInputElement;

  const loadModule = async (): Promise<void> => {
    jest.resetModules();
    modalElement = document.createElement("div");
    backdropElement = document.createElement("div");
    backdropElement.classList.add("hidden");
    backdropElement.setAttribute("hidden", "");
    maximizeButton = document.createElement("button");
    titleInput = document.createElement("input");
    titleInput.focus = jest.fn();
    titleInput.select = jest.fn();

    document.body.dataset.layout = "list";
    document.body.className = "";

    jest.doMock("../dom", () => ({
      __esModule: true,
      modal: modalElement,
      modalBackdrop: backdropElement,
      modalMaximizeButton: maximizeButton,
      titleInput
    }));

    modalModule = await import("../modal");
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    await loadModule();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const openModal = (mode: "create" | "edit"): void => {
    modalModule.openModal(mode);
    jest.runAllTimers();
  };

  test("setModalMaximized toggles maximize state and updates controls", () => {
    modalModule.setModalMaximized(true);
    expect(modalElement.classList.contains("modal--maximized")).toBe(true);
    expect(maximizeButton.getAttribute("aria-label")).toBe("Restore note editor size");
    expect(maximizeButton.textContent).toBe("⤡");

    modalModule.setModalMaximized(false);
    expect(modalElement.classList.contains("modal--maximized")).toBe(false);
    expect(maximizeButton.getAttribute("aria-label")).toBe("Maximize note editor");
    expect(maximizeButton.textContent).toBe("⤢");
  });

  test("toggleModalSize flips maximize state", () => {
    modalModule.toggleModalSize();
    expect(modalModule.getModalMaximized()).toBe(true);
    modalModule.toggleModalSize();
    expect(modalModule.getModalMaximized()).toBe(false);
  });

  test("openModal reveals modal and focuses title input", () => {
    openModal("edit");

    expect(backdropElement.classList.contains("hidden")).toBe(false);
    expect(backdropElement.hasAttribute("hidden")).toBe(false);
    expect(document.body.classList.contains("modal-open")).toBe(true);
    expect(modalElement.dataset.mode).toBe("edit");
    expect(titleInput.focus).toHaveBeenCalled();
    expect(titleInput.select).toHaveBeenCalled();
    expect(maximizeButton.textContent).toBe("⤢");
  });

  test("closeModal hides modal in list mode", () => {
    openModal("create");
    modalModule.closeModal();

    expect(backdropElement.classList.contains("hidden")).toBe(true);
    expect(backdropElement.getAttribute("hidden")).toBe("");
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(modalElement.dataset.mode).toBeUndefined();
  });

  test("closeModal keeps modal visible in desktop layout", async () => {
    await loadModule();
    openModal("edit");
    document.body.dataset.layout = "desktop";

    modalModule.closeModal();

    expect(backdropElement.classList.contains("hidden")).toBe(false);
    expect(backdropElement.hasAttribute("hidden")).toBe(false);
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(modalElement.dataset.mode).toBe("edit");
  });
});
