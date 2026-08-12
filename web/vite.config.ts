import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// The wasm module, its data and the game archives are produced by CMake / served from disk.
// main.ts loads the engine through Function("return import(url)") so the bundler never sees it —
// no `external` entry needed, and the dev server works without a build present.
export default defineConfig({
  plugins: [tailwindcss()],
  // SharedArrayBuffer needs a cross-origin-isolated page; the production host sets these too.
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
