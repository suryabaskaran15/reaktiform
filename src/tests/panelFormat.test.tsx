// @vitest-environment jsdom
// src/tests/panelFormat.test.tsx
// ─────────────────────────────────────────────────────────────
// Regression test for colDef.format precedence parity between the panel's
// DetailsTab and the grid's CellRenderer (see cellRendererFormat.test.tsx
// for the grid-side contract). Covers the gaps closed by this fix:
// badge/progress's unconditional static display, and richtext/time/rating's
// bespoke read-only display, all of which previously ignored col.format.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailsTab } from "../components/ReaktiformPanel/DetailsTab";
import type { ColumnDef, Row } from "../types";

// RichTextViewer mounts a Tiptap/ProseMirror editor via useEditor(), which
// needs DOM APIs jsdom doesn't implement. Stub it — this suite tests
// DetailsTab's precedence logic, not the rich text editor's internals.
vi.mock("../components/richtext/RichTextViewer", () => ({
  RichTextViewer: ({ value }: { value: string }) => (
    <div data-testid="richtext-viewer">{value}</div>
  ),
}));

type TestData = {
  id: string;
  title: string;
  status: string;
  completion: number;
  notes: string;
  meetingTime: string;
  score: number;
  dueDate: string;
};
type TestRow = Row<TestData>;

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "row-1",
    title: "Untitled",
    status: "active",
    completion: 40,
    notes: "<p>plain</p>",
    meetingTime: "14:30",
    score: 3,
    dueDate: "2026-08-26",
    _id: "row-1",
    _saved: true,
    _new: false,
    _draft: null,
    _errors: {},
    ...overrides,
  } as TestRow;
}

function renderTab(col: ColumnDef<TestData>, rowOverrides: Partial<TestRow> = {}) {
  return render(
    <DetailsTab<TestData>
      row={makeRow(rowOverrides)}
      rowId="row-1"
      columns={[col]}
      onSave={() => {}}
      onFieldChange={() => {}}
      resetKey={0}
      getComputedValue={() => undefined}
    />,
  );
}

describe("DetailsTab — colDef.format precedence", () => {
  it("applies format for a plain type (date) when the field is read-only", () => {
    renderTab({
      key: "dueDate",
      label: "Due Date",
      type: "date",
      readOnly: true,
      format: (v) => `formatted:${v as string}`,
    });
    expect(screen.getByText("formatted:2026-08-26")).toBeTruthy();
  });

  it("date/time with format set while editable now routes to the formatted trigger, not the plain raw input (see panelFormattedDateField.test.tsx)", () => {
    renderTab({
      key: "dueDate",
      label: "Due Date",
      type: "date",
      format: (v) => `formatted:${v as string}`,
      // readOnly omitted — isFieldReadOnly is false
    });
    expect(screen.getByText("formatted:2026-08-26")).toBeTruthy();
    expect(screen.queryByDisplayValue("2026-08-26")).toBeNull();
  });

  it("a plain type other than date/time with format set while editable still shows the raw live input (format has no editable-state effect outside date/time)", () => {
    renderTab({
      key: "title",
      label: "Title",
      type: "text",
      format: (v) => `formatted:${v as string}`,
      // readOnly omitted — isFieldReadOnly is false
    });
    expect(screen.queryByText("formatted:Untitled")).toBeNull();
    expect(screen.getByDisplayValue("Untitled")).toBeTruthy();
  });

  it("applies format for a badge column, overriding the badge display, even though badge is never editable (isFieldReadOnly stays false)", () => {
    renderTab({
      key: "status",
      label: "Status",
      type: "badge",
      options: [{ value: "active", label: "Active", color: "success" }],
      format: (v) => `status is ${v as string}`,
    });
    expect(screen.getByText("status is active")).toBeTruthy();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("still shows the badge display when badge has no format (unchanged behavior)", () => {
    renderTab({
      key: "status",
      label: "Status",
      type: "badge",
      options: [{ value: "active", label: "Active", color: "success" }],
    });
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("applies format for a progress column, overriding the progress bar", () => {
    renderTab({
      key: "completion",
      label: "Completion",
      type: "progress",
      format: (v) => `${v as number} of 100`,
    });
    expect(screen.getByText("40 of 100")).toBeTruthy();
    expect(screen.queryByText("40%")).toBeNull();
  });

  it("applies format for a read-only richtext field, overriding RichTextViewer", () => {
    renderTab({
      key: "notes",
      label: "Notes",
      type: "richtext",
      readOnly: true,
      format: () => "notes summary",
    });
    expect(screen.getByText("notes summary")).toBeTruthy();
    expect(screen.queryByTestId("richtext-viewer")).toBeNull();
  });

  it("applies format for a read-only time field, overriding formatTime()", () => {
    renderTab({
      key: "meetingTime",
      label: "Meeting Time",
      type: "time",
      readOnly: true,
      format: (v) => `at ${v as string}`,
    });
    expect(screen.getByText("at 14:30")).toBeTruthy();
    expect(screen.queryByText("02:30 PM")).toBeNull();
  });

  it("still shows formatTime()'s display when time has no format (unchanged behavior)", () => {
    renderTab({ key: "meetingTime", label: "Meeting Time", type: "time", readOnly: true });
    expect(screen.getByText("02:30 PM")).toBeTruthy();
  });

  it("applies format for a read-only rating field, overriding the star display", () => {
    renderTab({
      key: "score",
      label: "Score",
      type: "rating",
      readOnly: true,
      format: (v) => `${v as number}/5 stars`,
    });
    expect(screen.getByText("3/5 stars")).toBeTruthy();
    expect(screen.queryByText("3/5")).toBeNull();
  });

  it("falls back to raw String(value) for a plain type with no format (unchanged behavior)", () => {
    renderTab({ key: "title", label: "Title", type: "text", readOnly: true });
    expect(screen.getByText("Untitled")).toBeTruthy();
  });
});
