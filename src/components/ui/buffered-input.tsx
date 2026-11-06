import {
  useEffect,
  useState,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/cn";
import { Input } from "./input";

interface BufferedInputProps
  extends Omit<ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue"> {
  value: string;
  onCommit: (value: string) => void;
  /** Normalizes the draft before validation. */
  transform?: (value: string) => string;
  /** Reverts to the stored value when the normalized draft is rejected. */
  isValid?: (value: string) => boolean;
  /** Optional live error shown under the input while the draft is invalid. */
  getError?: (value: string) => string | null;
}

/**
 * Commits on blur or Enter. Keeps the store schema-valid while the user is
 * typing, so the debounced autosave never persists a half-typed identifier.
 */
export function BufferedInput({
  value,
  onCommit,
  transform,
  isValid,
  getError,
  onFocus,
  onBlur,
  onKeyDown,
  className,
  ...props
}: BufferedInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const normalizedDraft = transform ? transform(draft) : draft;
  const error = getError?.(normalizedDraft) ?? null;

  function commit() {
    const normalized = transform ? transform(draft) : draft;
    const rejected =
      (isValid && !isValid(normalized)) || (getError ? getError(normalized) !== null : false);
    const next = rejected ? value : normalized;
    setDraft(next);
    if (next !== value) onCommit(next);
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    commit();
    setFocused(false);
    onBlur?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    onKeyDown?.(event);
  }

  return (
    <div className="w-full">
      <Input
        className={cn(
          className,
          error && "border-danger focus:border-danger focus:ring-danger/25",
        )}
        {...props}
        aria-invalid={error ? true : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
