import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Deliberately separate from the root vite.config.ts (which is really the
// vitest config — see bench/README.md). This app is built with `vite build`
// then served with `vite preview` for benchmarking, NOT run via `vite dev` —
// the dev server's unbundled ESM graph, source maps, and HMR client would
// skew every timing number relative to what a real consumer experiences.
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  resolve: {
    // src/ uses its own "@/*" internal alias (see tsconfig.json paths) —
    // reproduce it here so Vite can resolve src/'s internal imports when
    // bundling it directly (bench builds against src, not the published
    // dist/ output — see bench/README.md's src-vs-dist note).
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  build: {
    outDir: path.resolve(__dirname, ".dist-bench"),
    emptyOutDir: true,
    minify: false, // keep component names legible in React Profiler ids
  },
  define: {
    // React's <Profiler onRender> callback is stripped from the standard
    // production react-dom build (verified: node_modules/react-dom/cjs
    // ships a profiling-enabled prod variant, react-dom.profiling.min.js,
    // but only react-dom's *legacy* entry point resolves to it — the
    // react-dom/client entry this app uses has no equivalent alias target).
    // `vite build --mode development` alone does NOT flip this: Vite ties
    // the literal `process.env.NODE_ENV` string replacement to the
    // build/serve *command*, not the --mode flag, so react-dom's own
    // conditional exports still resolved to its production build even
    // under `--mode development` until this explicit `define` was added.
    //
    // KNOWN TRADE-OFF, stated plainly: this makes bench/app always build
    // against react-dom's *development* bundle, which does more validation
    // work per render than true production — absolute numbers here will be
    // somewhat pessimistic relative to what a real consumer experiences.
    // Relative before/after comparisons (same dev-mode build both times,
    // per the roadmap's own benchmarking methodology) remain valid; this is
    // the accepted cost of getting Profiler data at all in Phase 0.
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
});
