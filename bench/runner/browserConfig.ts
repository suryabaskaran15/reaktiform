// Shared browser-launch constants. There is no playwright.config.ts here
// because Phase 0 deliberately uses the lower-level `playwright` package
// (not `@playwright/test`, which owns its own config/CLI/reporter
// conventions) — see bench/README.md's dependency-choice note.
export const PREVIEW_URL = "http://localhost:5199";
export const VIEWPORT = { width: 1440, height: 900 };
export const READY_TIMEOUT_MS = 20_000;
