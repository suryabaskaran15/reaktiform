// src/tests/panelModeSwitcher.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for the user-switchable panel mode:
//   - store slice (default, setter, seeding)
//   - persistence round-trip
//   - BACKWARD COMPATIBILITY: panelMode was added to the persisted shape
//     WITHOUT a version bump, so a v3 payload written before it existed must
//     still restore every other preference. If someone bumps STORAGE_VERSION
//     to add a field, that test fails — which is the whole point of it.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import { createGridStore } from "../store/gridStore";
import { loadPersistedState } from "../hooks/useGridPersistence";

const STORAGE_KEY = "rf-panel-mode-test";

/** A payload exactly as it was written before `panelMode` existed. */
const legacyPayload = {
  version: 3,
  columnWidths: { name: 220 },
  hiddenColumns: ["secret"],
  pinnedColumns: ["id"],
  columnOrder: ["id", "name"],
  activeFilters: {},
  aggregations: { amount: "sum" },
  cfRules: [],
  editLocked: true,
  // note: no panelMode
};

beforeEach(() => {
  localStorage.clear();
});

describe("panelMode store slice", () => {
  it("defaults to drawer", () => {
    expect(createGridStore().getState().panelMode).toBe("drawer");
  });

  it("setPanelMode updates the mode", () => {
    const store = createGridStore();
    store.getState().setPanelMode("page");
    expect(store.getState().panelMode).toBe("page");
    store.getState().setPanelMode("modal");
    expect(store.getState().panelMode).toBe("modal");
  });

  it("can be seeded via initialOverrides", () => {
    expect(createGridStore({ panelMode: "modal" }).getState().panelMode).toBe(
      "modal",
    );
  });
});

describe("panelMode persistence", () => {
  it("restores a saved mode", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...legacyPayload, panelMode: "page" }),
    );
    const store = createGridStore();
    loadPersistedState(STORAGE_KEY, store);
    expect(store.getState().panelMode).toBe("page");
  });

  it("leaves the default when nothing is persisted", () => {
    const store = createGridStore();
    loadPersistedState(STORAGE_KEY, store);
    expect(store.getState().panelMode).toBe("drawer");
  });

  // ── The regression guard for the no-version-bump decision ──
  it("reads a pre-panelMode v3 payload without dropping other preferences", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload));
    const store = createGridStore();
    loadPersistedState(STORAGE_KEY, store);

    const s = store.getState();
    // Everything that existed before panelMode must survive untouched...
    expect(s.columnWidths["name"]).toBe(220);
    expect(s.hiddenColumns.has("secret")).toBe(true);
    expect(s.pinnedColumns.has("id")).toBe(true);
    expect(s.columnOrder).toEqual(["id", "name"]);
    expect(s.aggregations["amount"]).toBe("sum");
    expect(s.editLocked).toBe(true);
    // ...and the absent field simply falls through to the default.
    expect(s.panelMode).toBe("drawer");
  });

  it("keeps the payload readable — the stored version is still 3", () => {
    // Adding an optional field must NOT bump STORAGE_VERSION: a mismatch
    // deletes the whole payload, costing every user their saved layout.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload));
    const store = createGridStore();
    loadPersistedState(STORAGE_KEY, store);
    // If the version had been bumped, readStorage would have removed the key.
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
