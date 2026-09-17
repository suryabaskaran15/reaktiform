// @vitest-environment jsdom
// src/tests/panelFormattedDateField.test.tsx
// ─────────────────────────────────────────────────────────────
// FormattedDateField/FormattedTimeField: when a date/time column sets
// col.format, the panel's own visible slot for that field must ALWAYS be
// the formatted text — never the raw value, never a native input's own
// browser-locale rendering. The real native <input type="date">/
// type="time"> is layered invisibly (opacity: 0) directly on top of the
// formatted display — there is no separate popup, no second visible box;
// clicking anywhere in the field hits the real (invisible) input and
// triggers the browser's own native picker via showPicker(). Deliberately
// picker-only, not typable (see FormattedDateField.tsx's header comment):
// a reveal-on-focus variant was tried and reverted because it necessarily
// brings back raw mm/dd/yyyy the moment the field is focused. See
// DetailsTab.tsx's switch for the col.format ? Formatted*Field : *Field
// routing this suite exercises.
//
// jsdom has no showPicker() implementation — the try/catch around it in
// the component must not throw or block onChange from working.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailsTab } from "../components/ReaktiformPanel/DetailsTab";
import type { ColumnDef, Row } from "../types";

type TestData = {
  id: string;
  dueDate: string;
  meetingTime: string;
};
type TestRow = Row<TestData>;

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
  } as TestRow;
}

// Stateful harness so onFieldChange round-trips into row._draft, mirroring
// markDirty/updateRowInStore in the real app — needed so the decorative
// text's re-formatted value after a change is actually observable.
function Harness({
  col,
  rowOverrides,
}: {
  col: ColumnDef<TestData>;
  rowOverrides: Partial<TestRow>;
}) {
  const [row, setRow] = useState<TestRow>(() => makeRow(rowOverrides));
  return (
    <DetailsTab<TestData>
      row={row}
      rowId="row-1"
      columns={[col]}
      onSave={() => {}}
      onFieldChange={(field, value) => {
        setRow((prev) => ({
          ...prev,
          _draft: { ...(prev._draft ?? {}), [field]: value },
        }));
      }}
      resetKey={0}
      getComputedValue={() => undefined}
    />
  );
}

function renderTab(col: ColumnDef<TestData>, rowOverrides: Partial<TestRow> = {}) {
  return render(<Harness col={col} rowOverrides={rowOverrides} />);
}

describe("FormattedDateField", () => {
  const dateCol: ColumnDef<TestData> = {
    key: "dueDate",
    label: "Due Date",
    type: "date",
    format: (v) => `formatted:${v as string}`,
  };

  it("shows the formatted text as a decorative, non-interactive element", () => {
    renderTab(dateCol);
    const decorative = screen.getByText("formatted:2026-08-26");
    expect(decorative).toBeTruthy();
    expect(decorative).toHaveAttribute("aria-hidden", "true");
    expect(decorative).toHaveStyle({ pointerEvents: "none" });
  });

  it("the real native date input is always present (not conditionally mounted), holding the raw value", () => {
    renderTab(dateCol);
    const input = screen.getByDisplayValue("2026-08-26");
    expect(input).toBeTruthy();
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).type).toBe("date");
    expect(input).toHaveStyle({ opacity: "0" });
  });

  it("changing the (invisible) input commits the raw value and the formatted text updates", () => {
    renderTab(dateCol);
    const input = screen.getByDisplayValue("2026-08-26");
    fireEvent.change(input, { target: { value: "2027-01-01" } });
    expect(screen.getByText("formatted:2027-01-01")).toBeTruthy();
    expect(screen.queryByText("formatted:2026-08-26")).toBeNull();
  });

  it("clicking the field does not throw even though jsdom has no showPicker()", () => {
    renderTab(dateCol);
    const input = screen.getByDisplayValue("2026-08-26");
    expect(() => fireEvent.click(input)).not.toThrow();
    expect(() => fireEvent.focus(input)).not.toThrow();
  });

  it("no format set: still renders the plain, unchanged raw input (regression guard)", () => {
    renderTab({ key: "dueDate", label: "Due Date", type: "date" });
    const input = screen.getByDisplayValue("2026-08-26");
    // Plain DateField's input is a normal, visible field — not overlaid
    // with opacity: 0.
    expect(input).not.toHaveStyle({ opacity: "0" });
  });

  it("locked/read-only with format set: still shows the existing static box, not this component", () => {
    renderTab({ ...dateCol, readOnly: true });
    expect(screen.getByText("formatted:2026-08-26")).toBeTruthy();
    // The locked static box has no input at all.
    expect(screen.queryByDisplayValue("2026-08-26")).toBeNull();
  });
});

describe("FormattedTimeField", () => {
  const timeCol: ColumnDef<TestData> = {
    key: "meetingTime",
    label: "Meeting Time",
    type: "time",
    format: (v) => `formatted:${v as string}`,
  };

  it("shows the formatted text as decorative; the real time input holds the raw value", () => {
    renderTab(timeCol);
    expect(screen.getByText("formatted:14:30")).toBeTruthy();
    const input = screen.getByDisplayValue("14:30");
    expect((input as HTMLInputElement).type).toBe("time");
  });

  it("changing the input commits the raw value and the formatted text updates", () => {
    renderTab(timeCol);
    const input = screen.getByDisplayValue("14:30");
    fireEvent.change(input, { target: { value: "09:15" } });
    expect(screen.getByText("formatted:09:15")).toBeTruthy();
    expect(screen.queryByText("formatted:14:30")).toBeNull();
  });

  it("no format set: still renders the plain, unchanged raw input (regression guard)", () => {
    renderTab({ key: "meetingTime", label: "Meeting Time", type: "time" });
    expect(screen.getByDisplayValue("14:30")).toBeTruthy();
  });
});
