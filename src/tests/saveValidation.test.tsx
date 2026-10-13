// @vitest-environment jsdom
// src/tests/saveValidation.test.tsx
// ─────────────────────────────────────────────────────────────
// saveRow / saveAll re-validate the merged row before saving instead of
// trusting row._errors, which only covers fields that went through
// markDirty — addRow starts a row with `_errors = {}`, so an untouched new
// row with an empty required field used to be saved.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { GridStoreProvider, useGridStore } from "../store";
import { useDraft } from "../hooks/useDraft";
import type { ColumnDef, Row } from "../types";

type TestData = Record<string, unknown>;

const columns: ColumnDef<TestData>[] = [
  { key: "id", label: "ID", type: "text" },
  { key: "name", label: "Name", type: "text", required: true },
];

function makeRow(id: string, name: string, draft: Record<string, unknown> | null) {
  return {
    id,
    name,
    _id: `_${id}`,
    _saved: draft === null,
    _new: true,
    _draft: draft,
    _errors: {}, // as addRow leaves it — never validated
  };
}

function setup(rows: Record<string, unknown>[]) {
  const onCreate = vi.fn(async () => undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GridStoreProvider initialState={{ rows } as never}>{children}</GridStoreProvider>
  );
  const { result } = renderHook(
    () => ({
      draft: useDraft<TestData>({ columns, rowIdKey: "id", onCreate } as never),
      rows: useGridStore((s) => s.rows) as Row<TestData>[],
    }),
    { wrapper },
  );
  return { result, onCreate };
}

describe("save re-validates instead of trusting row._errors", () => {
  it("saveRow blocks an untouched new row with an empty required field and writes _errors", async () => {
    const { result, onCreate } = setup([makeRow("r1", "", { id: "r1", name: "" })]);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.draft.saveRow("r1");
    });

    expect(ok).toBe(false);
    expect(onCreate).not.toHaveBeenCalled();
    expect(result.current.rows[0]!._errors).toEqual({ name: "Name is required" });
  });

  it("saveRow saves a valid row", async () => {
    const { result, onCreate } = setup([makeRow("r1", "", { id: "r1", name: "Pump" })]);
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.draft.saveRow("r1");
    });
    expect(ok).toBe(true);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("saveAll skips invalid rows, reports them, and writes their _errors", async () => {
    const { result, onCreate } = setup([
      makeRow("r1", "", { id: "r1", name: "" }),
      makeRow("r2", "", { id: "r2", name: "Valve" }),
    ]);

    let res: { saved: number; skipped: number } | undefined;
    await act(async () => {
      res = await result.current.draft.saveAll();
    });

    expect(res).toEqual({ saved: 1, skipped: 1 });
    expect(onCreate).toHaveBeenCalledTimes(1);
    const r1 = result.current.rows.find((r) => r["id"] === "r1")!;
    expect(r1._errors).toEqual({ name: "Name is required" });
  });
});
