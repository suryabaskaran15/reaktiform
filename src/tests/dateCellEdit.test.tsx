// @vitest-environment jsdom
// src/tests/dateCellEdit.test.tsx
// ─────────────────────────────────────────────────────────────
// Grid-side counterpart to panelFormattedDateField.test.tsx: while a
// date/time cell is being edited, the visible text must be formatted
// (colDef.format's output, or reaktiform's own default formatDate/
// formatTime) — never the browser's raw mm/dd/yyyy/HH:MM. The real native
// <input> is layered invisibly (opacity: 0) on top of that formatted
// display; clicking it triggers the browser's own native picker via
// showPicker(), but only one thing is ever visible. Deliberately
// picker-only, not typable — see DateCellEdit's header comment in
// DateCell.tsx. See CellRenderer.tsx's "date"/"time" cases for the
// formatted-text computation this exercises.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CellRenderer } from "../components/cells/CellRenderer";
import type { ColumnDef, Row } from "../types";

type TestRow = Row<{
  id: string;
  dueDate: string;
  meetingTime: string;
}>;

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "row-1",
    dueDate: "2026-08-26",
    meetingTime: "14:30",
    _id: "row-1",
    _saved: true,
    _new: false,
    _draft: null,
    _errors: {},
    ...overrides,
  };
}

const dateColWithFormat: ColumnDef<TestRow> = {
  key: "dueDate",
  label: "Due Date",
  type: "date",
  format: (v) => `formatted:${v as string}`,
};

const dateColNoFormat: ColumnDef<TestRow> = {
  key: "dueDate",
  label: "Due Date",
  type: "date",
};

const timeColWithFormat: ColumnDef<TestRow> = {
  key: "meetingTime",
  label: "Meeting Time",
  type: "time",
  format: (v) => `formatted:${v as string}`,
};

describe("DateCellEdit — formatted display while editing", () => {
  it("shows colDef.format's output, not the raw value, while editing", () => {
    render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColWithFormat}
        value="2026-08-26"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("formatted:2026-08-26")).toBeTruthy();
  });

  it("the real native input is present, invisible, and holds the raw value", () => {
    render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColWithFormat}
        value="2026-08-26"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByDisplayValue("2026-08-26") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input).toHaveStyle({ opacity: "0" });
  });

  it("falls back to reaktiform's own formatDate() when no colDef.format is set", () => {
    const { container: editContainer } = render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColNoFormat}
        value="2026-08-26"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    // Read mode's DateCellRead uses the same default formatDate() for the
    // same value — assert parity rather than hardcoding the exact string.
    const { container: readContainer } = render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColNoFormat}
        value="2026-08-26"
        isEditing={false}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    const readText = readContainer.querySelector("span")?.textContent;
    expect(readText).toBeTruthy();
    expect(within(editContainer).getByText(readText!)).toBeTruthy();
  });

  it("shows the empty-value placeholder while editing, matching DateCellRead's own default", () => {
    render(
      <CellRenderer
        row={makeRow({ dueDate: "" })}
        colDef={dateColWithFormat}
        value=""
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Pick date…")).toBeTruthy();
  });

  it("committing (calendar pick) still calls onCommit with the raw value", () => {
    const onCommit = vi.fn();
    render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColWithFormat}
        value="2026-08-26"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByDisplayValue("2026-08-26");
    fireEvent.change(input, { target: { value: "2027-01-01" } });
    expect(onCommit).toHaveBeenCalledWith("2027-01-01");
  });

  it("Escape still calls onCancel without committing", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <CellRenderer
        row={makeRow()}
        colDef={dateColWithFormat}
        value="2026-08-26"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const input = screen.getByDisplayValue("2026-08-26");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("TimeCellEdit — formatted display while editing", () => {
  it("shows colDef.format's output, not the raw value, while editing", () => {
    render(
      <CellRenderer
        row={makeRow()}
        colDef={timeColWithFormat}
        value="14:30"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("formatted:14:30")).toBeTruthy();
    const input = screen.getByDisplayValue("14:30") as HTMLInputElement;
    expect(input.type).toBe("time");
  });

  it("committing still calls onCommit with the raw value", () => {
    const onCommit = vi.fn();
    render(
      <CellRenderer
        row={makeRow()}
        colDef={timeColWithFormat}
        value="14:30"
        isEditing={true}
        isError={false}
        isDark={false}
        onCommit={onCommit}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByDisplayValue("14:30");
    fireEvent.change(input, { target: { value: "09:15" } });
    expect(onCommit).toHaveBeenCalledWith("09:15");
  });
});
