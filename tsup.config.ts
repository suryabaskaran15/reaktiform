import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, writeFileSync } from "fs";

// ── All peer / heavy runtime deps are external.
// Consumers install these via their own package.json.
// This prevents duplicate instances (two React, two Zustand, etc.)
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
  // ─────────────────────────────────────────────────────────────
  // BUNDLE 1 — Full UI
  // import { Reaktiform } from 'reaktiform'
  // import 'reaktiform/styles'
  // ─────────────────────────────────────────────────────────────
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
    dts: true,
    splitting: true, // code-split shared chunks (avoids duplicating cell code)
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false, // consumers' bundlers will minify
    external: EXTERNAL,
    esbuildOptions(opts) {
      opts.banner = { js: '"use client"' };
    },
    async onSuccess() {
      mkdirSync("dist", { recursive: true });
      copyFileSync("src/styles/reaktiform.css", "dist/reaktiform.css");

      // Copy pre-made CSS type declaration stubs into dist/.
      // These stubs are also committed in dist-types/ so TypeScript can
      // find them immediately after install, before any build step runs.
      copyFileSync(
        "dist-types/reaktiform.css.d.ts",
        "dist/reaktiform.css.d.ts",
      );
      copyFileSync("dist-types/cells.css.d.ts", "dist/cells.css.d.ts");

      console.log("✅ Full UI      → dist/index.{mjs,js,d.ts}");
      console.log("✅ CSS          → dist/reaktiform.css");
      console.log("✅ CSS types    → dist/reaktiform.css.d.ts");
    },
  },

  // ─────────────────────────────────────────────────────────────
  // BUNDLE 2 — Headless (hooks + logic, ZERO UI, ZERO CSS)
  // import { useReaktiform } from 'reaktiform/headless'
  // ─────────────────────────────────────────────────────────────
  {
    entry: { headless: "src/headless.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    async onSuccess() {
      console.log("✅ Headless     → dist/headless.{mjs,js,d.ts}");
    },
  },

  // ─────────────────────────────────────────────────────────────
  // BUNDLE 3 — Cell components (standalone inputs + display cells)
  // import { TextCellEdit, NumberCellEdit } from 'reaktiform/cells'
  // import 'reaktiform/styles'   (uses same CSS vars)
  // ─────────────────────────────────────────────────────────────
  {
    entry: { cells: "src/cells.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
    dts: true,
    splitting: true,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    esbuildOptions(opts) {
      opts.banner = { js: '"use client"' };
    },
    async onSuccess() {
      console.log("✅ Cells        → dist/cells.{mjs,js,d.ts}");
    },
  },

  // ─────────────────────────────────────────────────────────────
  // BUNDLE 4 — Primitives (Badge, ProgressBar)
  // import { Badge, ProgressBar } from 'reaktiform/primitives'
  // ─────────────────────────────────────────────────────────────
  {
    entry: { primitives: "src/primitives.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    esbuildOptions(opts) {
      opts.banner = { js: '"use client"' };
    },
    async onSuccess() {
      console.log("✅ Primitives   → dist/primitives.{mjs,js,d.ts}");
    },
  },

  // ─────────────────────────────────────────────────────────────
  // BUNDLE 5 — Utils (formatters, validators, helpers — zero React)
  // import { formatDate, formatCurrency } from 'reaktiform/utils'
  // ─────────────────────────────────────────────────────────────
  {
    entry: { utils: "src/utils-entry.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".js" }),
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    // No react/react-dom needed — utils are pure functions
    external: ["zod", "clsx", "tailwind-merge"],
    async onSuccess() {
      console.log("✅ Utils        → dist/utils.{mjs,js,d.ts}");
      console.log("\n🎉 Build complete!");
    },
  },
]);
