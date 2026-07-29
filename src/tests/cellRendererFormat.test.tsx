// @vitest-environment jsdom
// src/tests/cellRendererFormat.test.tsx
// ─────────────────────────────────────────────────────────────
// Regression test for colDef.format being wired into CellRenderer's
// read-mode rendering. Also locks in that format receives the merged
// (base + draft) row, matching the mergedRow() convention used for
// constraint resolution elsewhere in this file.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CellRenderer } from "../components/cells/CellRenderer";
import type { ColumnDef, Row } from "../types";

type TestRow = Row<{
  id: string;
  deductionValue: number;
  deductionUnit: "PERCENTAGE" | "AMOUNT";
}>;

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "row-1",
    deductionValue: 150,
    deductionUnit: "PERCENTAGE",
    _id: "row-1",
    _saved: true,
    _new: false,
    _draft: null,
    _errors: {},
    ...overrides,
  };
}

const numberCol: ColumnDef<TestRow> = {
  key: "deductionValue",
  label: "LAD % / Amount",
  type: "number",
  format: (value, row) =>
    row.deductionUnit === "PERCENTAGE"
      ? `${value as number}%`
      : `RM ${value as number}`,
};

describe("CellRenderer — colDef.format", () => {
  it("renders the formatted string instead of the raw value in read mode", () => {
    render(
      <CellRenderer
        row={makeRow()}
        colDef={numberCol}
        value={150}
        isEditing={false}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("150%")).toBeTruthy();
    expect(screen.queryByText("150", { exact: true })).toBeNull();
  });

  it("passes the merged (draft-aware) row to format, not the stale base row", () => {
    const row = makeRow({
      deductionUnit: "PERCENTAGE",
      _draft: { deductionUnit: "AMOUNT" },
    });

    render(
      <CellRenderer
        row={row}
        colDef={numberCol}
        value={150}
        isEditing={false}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("RM 150")).toBeTruthy();
  });

  it("does not apply format while the cell is in edit mode", () => {
    render(
      <CellRenderer
        row={makeRow()}
        colDef={numberCol}
        value={150}
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByText("150%")).toBeNull();
  });
});
