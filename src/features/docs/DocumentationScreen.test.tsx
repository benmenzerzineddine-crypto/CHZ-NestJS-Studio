import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { useUiStore } from "@/store/ui.store";
import { DocumentationScreen } from "./DocumentationScreen";

describe("DocumentationScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
    useUiStore.setState({
      screen: "documentation",
      selectedEntityId: null,
      toasts: [],
      validationOpen: false,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("renders overview topic and documentation layout by default", () => {
    render(<DocumentationScreen />);

    expect(screen.getByRole("heading", { name: "Documentation" })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search documentation…"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Overview & Architecture").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Desktop Studio")).toBeInTheDocument();
    expect(screen.getByText("Pure Engine Core")).toBeInTheDocument();
  });

  it("filters documentation topics when searching", () => {
    render(<DocumentationScreen />);

    const searchInput = screen.getByPlaceholderText("Search documentation…");
    fireEvent.change(searchInput, { target: { value: "OAuth" } });

    // Should match Authentication topic
    expect(screen.getByText("Authentication, 2FA & OAuth")).toBeInTheDocument();
    // Non-matching topic button shouldn't exist in sidebar
    expect(screen.queryByText("Keyboard Shortcuts Reference")).not.toBeInTheDocument();
  });

  it("switches active section when a topic is clicked", () => {
    render(<DocumentationScreen />);

    const authButton = screen.getByRole("button", {
      name: /Authentication, 2FA & OAuth/i,
    });
    fireEvent.click(authButton);

    expect(
      screen.getByText("JWT Access & Refresh Tokens"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Two-Factor Authentication (2FA)"),
    ).toBeInTheDocument();
  });

  it("navigates back to projects when no project is open", () => {
    render(<DocumentationScreen />);

    const backButton = screen.getByRole("button", { name: /Back to Projects/i });
    fireEvent.click(backButton);

    expect(useUiStore.getState().screen).toBe("projects");
  });

  it("navigates back to project settings when a project is open", () => {
    const project = createProject("Test API");
    useProjectStore.getState().openProject(project);

    render(<DocumentationScreen />);

    const backButton = screen.getByRole("button", { name: /Back to Project/i });
    fireEvent.click(backButton);

    expect(useUiStore.getState().screen).toBe("settings");
  });

  it("copies code blocks to clipboard when copy button is clicked", async () => {
    render(<DocumentationScreen />);

    const copyButtons = screen.getAllByRole("button", { name: /Copy code/i });
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });
});
