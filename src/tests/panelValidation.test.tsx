// @vitest-environment jsdom
// src/tests/panelValidation.test.tsx
// ─────────────────────────────────────────────────────────────
// The panel's DetailsTab is controlled by the row (draft over committed
// data) and validated only by validateRow — the same function the grid uses
// in markDirty/saveRow. Regression suite for the bug where the panel kept a
// parallel react-hook-form copy of the values: field components overrode
// RHF's onChange, so that copy never saw edits, and Save was blocked by
// "<Label> is required" on fields that were visibly filled.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DetailsTab } from "../components/ReaktiformPanel/DetailsTab";
import type { ColumnDef, Row } from "../types";

type TestData = Record<string, unknown>;
type TestRow = Row<TestData>;

function makeRow(values: Record<string, unknown>): TestRow {
  return {
    id: "row-1",
    _id: "row-1",
    _saved: false,
    _new: true,
    _draft: null,
    _errors: {},
    ...values,
  } as TestRow;
}

// Mirrors the grid: onFieldChange writes into row._draft (new row object),
// exactly like markDirty → updateRowInStore. `api.setDraft` simulates an
// external change (undo/redo, an inline edit) while the panel is open.
const api: { setDraft?: (patch: Record<string, unknown>) => void } = {};

function Harness({
  columns,
  initial,
  onSave,
}: {
  columns: ColumnDef<TestData>[];
  initial: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [row, setRow] = useState<TestRow>(() => makeRow(initial));
  const setDraft = (patch: Record<string, unknown>) =>
    setRow((prev) => ({ ...prev, _draft: { ...(prev._draft ?? {}), ...patch } }));
  api.setDraft = setDraft;
  return (
    <DetailsTab<TestData>
      row={row}
      rowId="row-1"
      columns={columns}
      onSave={onSave}
      onFieldChange={(field, value) => setDraft({ [field]: value })}
      resetKey={0}
      getComputedValue={() => undefined}
    />
  );
}

const submit = (container: HTMLElement) =>
  act(() => {
    fireEvent.submit(container.querySelector("form")!);
  });

const fmtDate = (v: unknown) => (v ? `D:${String(v)}` : "—");

describe("DetailsTab — validation uses the row as the single source of truth", () => {
  it("saves once every required field is filled (reported bug: formatted date stayed 'required')", async () => {
    const columns: ColumnDef<TestData>[] = [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "rfqDate", label: "RFQ Date", type: "date", required: true, format: fmtDate },
      { key: "plainDate", label: "Plain Date", type: "date", required: true },
      { key: "at", label: "At", type: "time", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [{ value: "open", label: "Open" }],
      },
      { key: "stars", label: "Stars", type: "rating", required: true },
      { key: "agree", label: "Agree", type: "checkbox", required: true },
    ];
    const onSave = vi.fn();
    const { container } = render(
      <Harness
        columns={columns}
        initial={{ name: "", qty: null, rfqDate: "", plainDate: "", at: "", status: "", stars: 0, agree: false }}
        onSave={onSave}
      />,
    );

    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: "Generator" } });
    fireEvent.change(container.querySelector('input[type="number"]')!, { target: { value: "3" } });
    const dates = container.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0]!, { target: { value: "2026-10-07" } });
    fireEvent.change(dates[1]!, { target: { value: "2026-10-22" } });
    fireEvent.change(container.querySelector('input[type="time"]')!, { target: { value: "09:30" } });
    fireEvent.change(container.querySelector("select")!, { target: { value: "open" } });
    fireEvent.click(screen.getByTitle("Rate 4 of 5"));
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);

    await submit(container);

    expect(screen.queryByText(/is required|must be checked/)).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      name: "Generator",
      qty: 3,
      rfqDate: "2026-10-07",
      plainDate: "2026-10-22",
      at: "09:30",
      status: "open",
      stars: 4,
      agree: true,
    });
  });

  it("blocks Save on empty required fields, then clears each error live as it's filled", async () => {
    const columns: ColumnDef<TestData>[] = [
      { key: "rfqDate", label: "RFQ Date", type: "date", required: true, format: fmtDate },
      { key: "name", label: "Name", type: "text", required: true },
    ];
    const onSave = vi.fn();
    const { container } = render(
      <Harness columns={columns} initial={{ rfqDate: "", name: "" }} onSave={onSave} />,
    );

    // Pristine form: no errors before the user has done anything.
    expect(screen.queryByText("RFQ Date is required")).toBeNull();

    await submit(container);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("RFQ Date is required")).toBeTruthy();
    expect(screen.getByText("Name is required")).toBeTruthy();

    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2026-10-07" } });
    expect(screen.queryByText("RFQ Date is required")).toBeNull();
    expect(screen.getByText("Name is required")).toBeTruthy();
  });

  it("reflects external row changes (undo / inline edit) while the panel is open", () => {
    const columns: ColumnDef<TestData>[] = [
      { key: "name", label: "Name", type: "text" },
      { key: "rfqDate", label: "RFQ Date", type: "date", format: fmtDate },
    ];
    const { container } = render(
      <Harness columns={columns} initial={{ name: "Before", rfqDate: "2026-01-01" }} onSave={vi.fn()} />,
    );
    const text = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    fireEvent.change(text, { target: { value: "Typed" } });
    expect(text.value).toBe("Typed");

    act(() => api.setDraft!({ name: "Undone", rfqDate: "2026-12-31" }));
    expect(text.value).toBe("Undone");
    expect(container.querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe("2026-12-31");
    expect(screen.getByText("D:2026-12-31")).toBeTruthy();
  });

  it("shows col.validate and dynamic minDate messages, same as inline editing", async () => {
    const columns: ColumnDef<TestData>[] = [
      { key: "rfqDate", label: "RFQ Date", type: "date", required: true },
      {
        key: "prDate",
        label: "PR Date",
        type: "date",
        required: true,
        validate: (v, values) =>
          values?.["rfqDate"] && String(v) < String(values["rfqDate"])
            ? "PR Date must be after RFQ Date"
            : undefined,
      },
    ];
    const onSave = vi.fn();
    const { container } = render(
      <Harness columns={columns} initial={{ rfqDate: "2026-10-22", prDate: "2026-10-07" }} onSave={onSave} />,
    );
    await submit(container);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("PR Date must be after RFQ Date")).toBeTruthy();
  });

  it("standalone use: typing works even when the consumer never feeds edits back into `row`", async () => {
    const columns: ColumnDef<TestData>[] = [
      { key: "name", label: "Name", type: "text", required: true },
    ];
    const onSave = vi.fn();
    const staticRow = makeRow({ name: "" });
    const { container } = render(
      <DetailsTab<TestData>
        row={staticRow}
        rowId="row-1"
        columns={columns}
        onSave={onSave}
        onFieldChange={() => {}}
        resetKey={0}
        getComputedValue={() => undefined}
      />,
    );
    const text = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    fireEvent.change(text, { target: { value: "Local" } });
    expect(text.value).toBe("Local");

    await submit(container);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Local" }));
  });
});
