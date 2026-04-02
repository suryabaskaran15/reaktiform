import { defineConfig } from "tsup";
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { resolve } from "path";

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
  // ── Main bundle
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    esbuildOptions(options) {
      options.banner = { js: '"use client"' };
    },
    async onSuccess() {
      mkdirSync("dist", { recursive: true });

      // Build the complete self-contained CSS:
      // Tailwind scans all .tsx source files and generates ONLY the
      // utility classes actually used — plus our CSS variable tokens.
      // Output: dist/reaktiform.css
      // Consumers: import 'reaktiform/styles'  — no Tailwind config needed.
      console.log("📦 Building CSS...");
      execSync(
        "npx @tailwindcss/cli -i src/styles/build-entry.css -o dist/reaktiform.css --minify",
        { stdio: "inherit" },
      );
      console.log("✅ Main bundle + CSS built");
    },
  },

  // ── Headless bundle
  {
    entry: { headless: "src/headless.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: EXTERNAL,
    async onSuccess() {
      console.log("✅ Headless bundle built");
    },
  },
]);
