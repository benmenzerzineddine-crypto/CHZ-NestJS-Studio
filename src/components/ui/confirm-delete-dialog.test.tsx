import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

describe("ConfirmDeleteDialog", () => {
  it("renders when open and handles confirm", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete Item?"
        description="This will permanently delete the item."
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Delete Item?")).toBeInTheDocument();
    expect(screen.getByText("This will permanently delete the item.")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Yes, delete" });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles cancel button click", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete Item?"
        description="Are you sure?"
        onConfirm={onConfirm}
      />,
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("respects disabled state on confirm button", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete Item"
        description="Cannot delete"
        disabled={true}
        onConfirm={onConfirm}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    expect(deleteBtn).toBeDisabled();
  });
});
