import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";

// All runtime deps are external — consumers install them via package.json.
// Prevents duplicate instances and keeps the bundle lean.
const EXTERNAL = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react-select",
  "react-select/async",
  "react-select/creatable",
  "react-select/async-creatable",
  "zustand",
  "immer",
  "zod",
  "react-hook-form",
  "@hookform/resolvers",
  "@hookform/resolvers/zod",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "@tanstack/react-table",
  "@tanstack/react-virtual",
];

export default defineConfig([
  // ── Main bundle (Reaktiform + ReaktiformPanel + hooks)
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true, // wipes dist/ before build
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    esbuildOptions(options) {
      options.banner = { js: '"use client"' };
    },
    // Copy CSS into dist/ after the JS bundle is written.
    // tsup does not process CSS — we copy it verbatim so consumers
    // can do: import 'reaktiform/styles'
    async onSuccess() {
      mkdirSync("dist", { recursive: true });
      copyFileSync(
        resolve("src/styles/reaktiform.css"),
        resolve("dist/reaktiform.css"),
      );
      console.log("✅ Main bundle built");
      console.log("✅ dist/reaktiform.css copied");
    },
  },

  // ── Headless bundle (hooks only — zero UI, zero styles)
  {
    entry: { headless: "src/headless.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    onSuccess: async () => {
      console.log("✅ Headless bundle built");
    },
  },
]);
