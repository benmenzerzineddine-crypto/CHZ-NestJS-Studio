import { AlertCircle, AlertTriangle, CheckCircle2, Copy, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/store/ui.store";

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const tones = {
  info: "text-muted",
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
};

export function Toaster() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind];
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-3 shadow-xl shadow-black/40"
            role="status"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tones[toast.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{toast.title}</p>
              {toast.message ? (
                <p className="mt-1 break-words text-xs leading-relaxed text-muted">
                  {toast.message}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {toast.detail || toast.message ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(toast.detail ?? toast.message ?? "");
                  }}
                  className="rounded p-0.5 text-muted transition-colors hover:text-foreground"
                  aria-label="Copy notification details"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded p-0.5 text-muted transition-colors hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
