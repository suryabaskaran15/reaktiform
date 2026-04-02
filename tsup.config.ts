import { defineConfig } from "tsup";

// All runtime deps are external — consumers install them via package.json.
// This prevents duplicate copies (e.g. two zustand instances) and keeps
// the reaktiform bundle as small as possible.
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
    splitting: true, // code-splitting — consumers only load what they import
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false, // let consumer's bundler minify with their own config
    external: EXTERNAL,
    esbuildOptions(options) {
      options.banner = { js: '"use client"' };
    },
    onSuccess: "echo ✅ Main bundle built",
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
    onSuccess: "echo ✅ Headless bundle built",
  },
]);
