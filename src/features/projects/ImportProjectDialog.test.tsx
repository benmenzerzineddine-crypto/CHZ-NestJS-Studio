import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportProjectDialog } from "./ImportProjectDialog";

describe("ImportProjectDialog", () => {
  const onImport = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open and shows real-time parse preview for default sample SQL", async () => {
    render(
      <ImportProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onImport={onImport}
      />,
    );

    expect(
      screen.getByText("Import schema to project"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Database driver/i)).toHaveValue("postgres");

    // Default sample SQL has users and posts
    await waitFor(() => {
      expect(screen.getByText(/Detected 2 entities/i)).toBeInTheDocument();
      expect(screen.getByText("Valid")).toBeInTheDocument();
    });
  });

  it("submits imported project when clicking import button", async () => {
    render(
      <ImportProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onImport={onImport}
      />,
    );

    const importBtn = screen.getByRole("button", {
      name: /Import & Open Project/i,
    });
    expect(importBtn).not.toBeDisabled();

    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
      const passedProject = onImport.mock.calls[0][0];
      expect(passedProject.entities.length).toBe(2);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("updates preview when TypeORM source code is entered", async () => {
    render(
      <ImportProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onImport={onImport}
      />,
    );

    const textarea = screen.getByLabelText(/Schema definition or code/i);
    const typeormCode = `
      @Entity('books')
      export class Book {
        @PrimaryGeneratedColumn()
        id: number;
        @Column()
        title: string;
      }
    `;

    fireEvent.change(textarea, { target: { value: typeormCode } });

    await waitFor(() => {
      expect(screen.getByText(/Detected 2 entities/i)).toBeInTheDocument();
      expect(screen.getByText("typeorm")).toBeInTheDocument();
      expect(screen.getByText(/Book \(2 cols/i)).toBeInTheDocument();
    });
  });

  it("disables import button when schema content is empty or invalid", async () => {
    render(
      <ImportProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onImport={onImport}
      />,
    );

    const textarea = screen.getByLabelText(/Schema definition or code/i);
    fireEvent.change(textarea, { target: { value: "" } });

    const importBtn = screen.getByRole("button", {
      name: /Import & Open Project/i,
    });
    expect(importBtn).toBeDisabled();
  });
});
