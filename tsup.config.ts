import { defineConfig } from "tsup";
import { execSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";

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

      // Step 1 — Build CSS with Tailwind v4 CLI
      console.log("📦 Building CSS with Tailwind...");
      execSync(
        "npx @tailwindcss/cli -i src/styles/build-entry.css -o dist/reaktiform.css --minify",
        { stdio: "inherit" },
      );

      // Step 2 — Strip @layer wrappers from output so the CSS is compatible
      // with projects using Tailwind v3 (PostCSS) or no Tailwind at all.
      // @layer base { ... }  →  the rules inside, unwrapped
      // @layer utilities { ... }  →  the rules inside, unwrapped
      // @layer theme { ... }  →  the rules inside, unwrapped
      // @layer components { ... }  →  removed (empty)
      console.log(
        "🔧 Stripping @layer wrappers for cross-version compatibility...",
      );
      let css = readFileSync("dist/reaktiform.css", "utf8");

      // Remove @layer X { ... } wrappers — keep the content inside
      // This regex handles nested braces correctly via iterative replacement
      const LAYER_NAMES = [
        "properties",
        "theme",
        "base",
        "utilities",
        "components",
      ];
      for (const layer of LAYER_NAMES) {
        // Match @layer name { ... } with balanced braces
        const re = new RegExp(`@layer\\s+${layer}\\s*\\{`, "g");
        let match;
        while ((match = re.exec(css)) !== null) {
          const start = match.index;
          const bodyStart = start + match[0].length;
          let depth = 1;
          let i = bodyStart;
          while (i < css.length && depth > 0) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
            i++;
          }
          // Replace the @layer wrapper with its inner content (or empty for empty layers)
          const inner = css.slice(bodyStart, i - 1).trim();
          css = css.slice(0, start) + (inner ? inner + " " : "") + css.slice(i);
          re.lastIndex = start; // reset because string changed
        }
      }

      // Remove empty @layer declarations that might remain
      css = css.replace(/@layer\s+\w+\s*\{\s*\}/g, "");

      // Remove @supports blocks that only contain Tailwind internal @property rules
      // (these use advanced CSS @property syntax fine in modern browsers but
      //  we keep them — they're plain CSS, not @layer, so no conflict)

      writeFileSync("dist/reaktiform.css", css);
      console.log(
        "✅ dist/reaktiform.css built — plain CSS, no @layer wrappers",
      );
      console.log("✅ Compatible with Tailwind v3, v4, or no Tailwind");
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
