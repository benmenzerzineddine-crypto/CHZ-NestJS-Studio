import { useEffect } from "react";

const STORAGE_KEY = "chz-nest.window-bounds";

interface Bounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

function readBounds(): Bounds | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Bounds>;
    if (
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number" ||
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number"
    ) {
      return null;
    }
    return parsed as Bounds;
  } catch {
    return null;
  }
}

/**
 * Restores the last window bounds in the desktop app and persists later moves.
 * Browser preview is a no-op.
 */
export function useWindowState(): void {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    const unlisten: Array<() => void> = [];

    async function setup() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
      const current = getCurrentWindow();

      const saved = readBounds();
      if (saved) {
        try {
          await current.setSize(new PhysicalSize(saved.width, saved.height));
          await current.setPosition(new PhysicalPosition(saved.x, saved.y));
        } catch {
          // The saved monitor may no longer exist; keep the configured default.
        }
      }

      let timer: number | undefined;
      const persist = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void (async () => {
            const size = await current.outerSize();
            const position = await current.outerPosition();
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                width: size.width,
                height: size.height,
                x: position.x,
                y: position.y,
              }),
            );
          })();
        }, 250);
      };

      unlisten.push(await current.onResized(persist));
      unlisten.push(await current.onMoved(persist));
      if (disposed) {
        unlisten.forEach((stop) => stop());
      }
    }

    void setup();
    return () => {
      disposed = true;
      unlisten.forEach((stop) => stop());
    };
  }, []);
}
