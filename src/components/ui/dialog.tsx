import { Modal } from "@heroui/react";
import React, { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogContextValue {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue>({});

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export const DialogTrigger = Modal.Trigger;
export const DialogClose = Modal.CloseTrigger;

export function DialogContent({
  className,
  children,
  role = "dialog",
  ...props
}: Omit<ComponentProps<"div">, "role"> & { role?: "dialog" | "alertdialog" }) {
  const { open, onOpenChange } = useContext(DialogContext);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange?.(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (open === false) return null;

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog
          role="dialog"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-2xl shadow-black/50 focus:outline-none",
            className,
          )}
          {...props}
        >
          {children}
          <Modal.CloseTrigger className="absolute right-4 top-4 rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-5 flex flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-6 flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof Modal.Heading>) {
  return (
    <Modal.Heading
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
}

