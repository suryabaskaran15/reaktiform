// src/tests/resolveFieldValue.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for resolveFieldValue — the shared, column-aware value
// resolver used by both the grid cell (useDraft's getVal) and the
// Record Details panel (DetailsTab). Regression coverage for the
// bug where the panel showed async select/multiselect fields blank:
// it was reading raw row values via a column-unaware helper that
// never applied col.valueTransform.read, while the grid cell did.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { resolveFieldValue } from "../utils";
import type { ColumnDef, Row } from "../types";

// ── Helpers ──────────────────────────────────────────────────

function col(overrides: Partial<ColumnDef>): ColumnDef {
  return {
    key: "category",
    label: "Category",
    type: "select",
    ...overrides,
  };
}

function row(data: Record<string, unknown>, draft: Record<string, unknown> | null = null): Row {
  return {
    _id: "_1",
    _saved: true,
    _new: false,
    _draft: draft,
    _errors: {},
    ...data,
  } as Row;
}

// ── resolveFieldValue ────────────────────────────────────────

describe("resolveFieldValue", () => {
  it("returns the raw committed value when the column has no valueTransform", () => {
    const c = col({ valueTransform: undefined });
    const r = row({ category: "civil" });
    expect(resolveFieldValue(r, c)).toBe("civil");
  });

  it("applies valueTransform.read to a raw API-shaped committed value (the panel bug scenario)", () => {
    const c = col({
      loadOptions: async () => [],
      valueTransform: {
        read: (raw) => {
          const r = raw as { id?: string; name?: string } | null;
          return r ? { value: r.id ?? "", label: r.name ?? "" } : undefined;
        },
        write: (value) => {
          const opt = value as { value: string; label: string };
          return opt.value ? { id: opt.value, name: opt.label } : null;
        },
      },
    });
    const r = row({ category: { id: "cat-1", name: "Civil" } });

    expect(resolveFieldValue(r, c)).toEqual({ value: "cat-1", label: "Civil" });
  });

  it("does not re-apply valueTransform.read to a draft value (already in internal { value, label } shape)", () => {
    const c = col({
      loadOptions: async () => [],
      valueTransform: {
        read: (raw) => {
          const r = raw as { id?: string; name?: string } | null;
          return r ? { value: r.id ?? "", label: r.name ?? "" } : undefined;
        },
        write: (value) => value,
      },
    });
    const r = row(
      { category: { id: "cat-1", name: "Civil" } },
      { category: { value: "cat-2", label: "Mechanical" } },
    );

    expect(resolveFieldValue(r, c)).toEqual({ value: "cat-2", label: "Mechanical" });
  });

  it("falls back to the raw value if valueTransform.read throws", () => {
    const c = col({
      valueTransform: {
        read: () => {
          throw new Error("boom");
        },
        write: (v) => v,
      },
    });
    const r = row({ category: { id: "cat-1", name: "Civil" } });

    expect(resolveFieldValue(r, c)).toEqual({ id: "cat-1", name: "Civil" });
  });

  it("skips the transform and returns null/undefined as-is", () => {
    const c = col({
      valueTransform: {
        read: (raw) => raw as never,
        write: (v) => v,
      },
    });
    expect(resolveFieldValue(row({ category: null }), c)).toBeNull();
    expect(resolveFieldValue(row({ category: undefined }), c)).toBeUndefined();
  });
});
