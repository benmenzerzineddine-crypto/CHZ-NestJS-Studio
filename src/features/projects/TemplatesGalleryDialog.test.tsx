import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesGalleryDialog } from "./TemplatesGalleryDialog";

describe("TemplatesGalleryDialog", () => {
  const onSelectTemplate = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open and lists all 4 templates", () => {
    render(
      <TemplatesGalleryDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    expect(screen.getByText("Project Templates Gallery")).toBeInTheDocument();
    expect(screen.getByText("SaaS Starter")).toBeInTheDocument();
    expect(screen.getByText("E-Commerce Starter")).toBeInTheDocument();
    expect(screen.getByText("CRM Starter")).toBeInTheDocument();
    expect(screen.getByText("Blog & CMS Starter")).toBeInTheDocument();
  });

  it("filters templates by category tab", () => {
    render(
      <TemplatesGalleryDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    // Click E-Commerce tab
    const ecommerceTab = screen.getByRole("button", { name: "E-Commerce" });
    fireEvent.click(ecommerceTab);

    expect(screen.getByText("E-Commerce Starter")).toBeInTheDocument();
    expect(screen.queryByText("SaaS Starter")).not.toBeInTheDocument();
    expect(screen.queryByText("CRM Starter")).not.toBeInTheDocument();
  });

  it("filters templates by search term", () => {
    render(
      <TemplatesGalleryDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search templates…");
    fireEvent.change(searchInput, { target: { value: "pipeline" } });

    expect(screen.getByText("CRM Starter")).toBeInTheDocument();
    expect(screen.queryByText("E-Commerce Starter")).not.toBeInTheDocument();
    expect(screen.queryByText("SaaS Starter")).not.toBeInTheDocument();
  });

  it("opens customization step and creates project when clicking use template", async () => {
    render(
      <TemplatesGalleryDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    // Find all 'Use template' buttons and click the first (SaaS)
    const useButtons = screen.getAllByRole("button", { name: "Use template" });
    expect(useButtons.length).toBeGreaterThan(0);
    fireEvent.click(useButtons[0]);

    // Should now show customization step
    expect(screen.getByText("Back to all templates")).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toHaveValue("SaaS Starter");

    // Change project name
    const nameInput = screen.getByLabelText("Project name");
    fireEvent.change(nameInput, { target: { value: "My Multi-Tenant Platform" } });

    // Submit creation
    const createBtn = screen.getByRole("button", { name: "Create project" });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(onSelectTemplate).toHaveBeenCalledTimes(1);
      const passedProject = onSelectTemplate.mock.calls[0][0];
      expect(passedProject.name).toBe("My Multi-Tenant Platform");
      expect(passedProject.settings.multitenancy.enabled).toBe(true);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("navigates back to gallery from customization step", () => {
    render(
      <TemplatesGalleryDialog
        open={true}
        onOpenChange={onOpenChange}
        onSelectTemplate={onSelectTemplate}
      />,
    );

    const useButtons = screen.getAllByRole("button", { name: "Use template" });
    fireEvent.click(useButtons[0]);

    const backButton = screen.getByText("Back to all templates");
    fireEvent.click(backButton);

    expect(screen.getByText("All Templates")).toBeInTheDocument();
    expect(screen.getByText("E-Commerce Starter")).toBeInTheDocument();
  });
});
