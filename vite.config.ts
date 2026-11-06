import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("@heroui") ||
              id.includes("react-aria") ||
              id.includes("react-stately") ||
              id.includes("@react-aria") ||
              id.includes("@react-stately")
            ) {
              return "vendor-heroui";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("prettier/plugins/typescript") || id.includes("@prettier/plugin-typescript")) {
              return "prettier-parser-ts";
            }
            if (id.includes("prettier/plugins/babel") || id.includes("prettier/plugins/estree")) {
              return "prettier-parser-babel";
            }
            if (id.includes("prettier")) {
              return "vendor-prettier";
            }
            if (id.includes("@monaco-editor")) {
              return "vendor-monaco";
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    testTimeout: 15_000,
  },
}));
