import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app/App";
import { createEntity, createProject } from "@/core/model/defaults";
import { useGenerateStore } from "@/store/generate.store";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";

function openFixture(): void {
  const project = createProject("Polish API");
  project.entities.push(createEntity("Post"));
  useProjectStore.setState({
    project: null,
    status: "idle",
    revision: 0,
    lastSavedAt: null,
    error: null,
  });
  useProjectStore.temporal.getState().clear();
  useProjectStore.getState().openProject(project);
  useUiStore.setState({
    screen: "entities",
    designerTab: "entities",
    selectedEntityId: "ent_user",
    selectedFieldId: null,
    selectedEnumId: null,
    toasts: [],
    validationOpen: false,
  });
}

describe("studio polish", () => {
  beforeEach(() => {
    window.localStorage.clear();
    openFixture();
  });

  it("opens model checks from the header badge", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open model checks" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Model checks");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("moves entity selection with arrow keys", () => {
    render(<App />);
    const before = useUiStore.getState().selectedEntityId;

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(useUiStore.getState().selectedEntityId).not.toBe(before);
  });

  it("generates with Ctrl/Cmd+Enter", () => {
    const run = vi.spyOn(useGenerateStore.getState(), "run").mockResolvedValue();
    render(<App />);

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("marks the page dirty on beforeunload", () => {
    useProjectStore.setState({ status: "dirty" });
    render(<App />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("copies toast details", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    useUiStore.setState({
      toasts: [
        { id: "toast_1", kind: "error", title: "Export failed", message: "Try again", detail: "stack trace" },
      ],
    });
    render(<App />);

    fireEvent.click(screen.getByLabelText("Copy notification details"));

    expect(writeText).toHaveBeenCalledWith("stack trace");
  });
});
