const DRIVE_LETTER = /^[A-Za-z]:/;

/**
 * Generated paths are joined to a user-selected folder. Reject anything that
 * could escape that folder, even though the emitters never produce such paths.
 */
export function assertSafeRelativePath(value: string): string {
  if (value.length === 0) throw new Error("Generated path is empty.");
  if (value.includes("\0")) throw new Error(`Generated path contains a null byte: ${value}`);
  if (value.includes("\\")) {
    throw new Error(`Generated path must use forward slashes: ${value}`);
  }
  if (DRIVE_LETTER.test(value)) {
    throw new Error(`Generated path must be relative: ${value}`);
  }
  if (value.startsWith("/")) {
    throw new Error(`Generated path must be relative: ${value}`);
  }

  for (const segment of value.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(`Generated path contains an unsafe segment: ${value}`);
    }
  }

  return value;
}
