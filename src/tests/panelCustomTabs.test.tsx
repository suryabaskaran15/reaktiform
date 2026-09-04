// @vitest-environment jsdom
// src/tests/panelCustomTabs.test.tsx
// ─────────────────────────────────────────────────────────────
// Exercises consumer-defined panel tabs — the `panelTabs` entries that are
// full tab definitions rather than built-in tab names. Covers strip
// composition, the render context handed to a custom tab, and the guarantee
// that a custom tab can never widen what permissions / Edit Lock allow.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaktiformPanel } from "../components/ReaktiformPanel/ReaktiformPanel";
import type { ColumnDef, PanelTabContext, Row } from "../types";

type TestData = { id: string; title: string; budget: number };
type TestRow = Row<TestData>;

const columns: ColumnDef<TestData>[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "budget", label: "Budget", type: "currency" },
];

function makeRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: "row-1",
    title: "Test row",
    budget: 100,
    _id: "row-1",
    _saved: true,
    _new: false,
    _draft: null,
    _errors: {},
    ...overrides,
  } as TestRow;
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof ReaktiformPanel<TestData>>> = {},
) {
  return render(
    <ReaktiformPanel<TestData>
      row={makeRow()}
      columns={columns}
      isOpen
      onClose={() => {}}
      onSave={() => {}}
      onDiscard={() => {}}
      {...props}
    />,
  );
}

/** Labels in the tab strip, in render order. */
function tabLabels(): string[] {
  const strip = document.querySelector("[data-rf-panel-tabs]")!;
  return Array.from(strip.children).map((el) => (el.textContent ?? "").trim());
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe("ReaktiformPanel — custom tabs", () => {
  it("renders a custom tab in its declared position among built-ins", () => {
    renderPanel({
      onAddComment: () => {},
      panelTabs: [
        "details",
        { id: "history", label: "History", render: () => <div /> },
        "activity",
      ],
    });

    expect(tabLabels()).toEqual(["Details", "History", "Activity"]);
  });

  it("shows the custom tab's body when it is selected", () => {
    renderPanel({
      panelTabs: [
        "details",
        {
          id: "history",
          label: "History",
          render: () => <div>audit trail body</div>,
        },
      ],
    });

    expect(screen.queryByText("audit trail body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.getByText("audit trail body")).toBeTruthy();
  });

  it("hands the render fn the MERGED record, not the stale base row", () => {
    let ctx: PanelTabContext<TestData> | null = null;
    renderPanel({
      row: makeRow({ _draft: { budget: 250 } }),
      panelTabs: [
        {
          id: "calc",
          label: "Calc",
          render: (c) => {
            ctx = c;
            return <div />;
          },
        },
      ],
    });

    expect(ctx).not.toBeNull();
    // base row keeps the last-saved value; `values` reflects the pending edit
    expect(ctx!.row.budget).toBe(100);
    expect(ctx!.values.budget).toBe(250);
    expect(ctx!.rowId).toBe("row-1");
    expect(ctx!.isDirty).toBe(true);
    expect(ctx!.columns).toHaveLength(2);
  });

  it("wires setValue / save / discard / close to the panel callbacks", () => {
    const onFieldChange = vi.fn();
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    const onClose = vi.fn();
    let ctx: PanelTabContext<TestData> | null = null;

    renderPanel({
      row: makeRow({ _draft: { budget: 250 } }),
      onFieldChange,
      onSave,
      onDiscard,
      onClose,
      panelTabs: [
        {
          id: "calc",
          label: "Calc",
          render: (c) => {
            ctx = c;
            return <div />;
          },
        },
      ],
    });

    ctx!.setValue("budget", 999);
    expect(onFieldChange).toHaveBeenCalledWith("row-1", "budget", 999);

    ctx!.save();
    expect(onSave).toHaveBeenCalledWith("row-1", { budget: 250 });

    ctx!.discard();
    expect(onDiscard).toHaveBeenCalledWith("row-1");

    ctx!.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A custom tab is a new mutation path — Edit Lock and permissions must
  // narrow it exactly like every other one (CLAUDE.md rule 9).
  it.each([
    ["editLocked", { editLocked: true }],
    ["canEdit: false", { canEdit: false }],
  ])("makes setValue/save no-ops under %s", (_label, lockProps) => {
    const onFieldChange = vi.fn();
    const onSave = vi.fn();
    let ctx: PanelTabContext<TestData> | null = null;

    renderPanel({
      ...lockProps,
      onFieldChange,
      onSave,
      panelTabs: [
        {
          id: "calc",
          label: "Calc",
          render: (c) => {
            ctx = c;
            return <div />;
          },
        },
      ],
    });

    ctx!.setValue("budget", 999);
    ctx!.save();

    expect(onFieldChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    // the tab is told why, so it can render itself read-only
    expect(ctx!.canEdit && !ctx!.editLocked).toBe(false);
  });

  it("hides a tab via visible: false and visible: (row) => false", () => {
    renderPanel({
      panelTabs: [
        "details",
        { id: "a", label: "StaticHidden", visible: false, render: () => null },
        {
          id: "b",
          label: "RowHidden",
          visible: (r) => !r._new,
          render: () => null,
        },
      ],
      row: makeRow({ _new: true }),
    });

    expect(tabLabels()).toEqual(["Details"]);
  });

  it("renders a badge and tolerates a tab with no icon", () => {
    renderPanel({
      panelTabs: [
        "details",
        { id: "links", label: "Linked", badge: 4, render: () => null },
      ],
    });

    const tab = screen.getByRole("button", { name: /Linked/ });
    expect(tab.textContent).toContain("4");
    expect(tab.querySelector("svg")).toBeNull(); // no icon given, no icon rendered
  });

  it("shows the footer only when a custom tab opts in, and its Save works", () => {
    const onSave = vi.fn();
    renderPanel({
      row: makeRow({ _draft: { budget: 250 } }),
      onSave,
      panelTabs: [
        "details",
        { id: "plain", label: "Plain", render: () => null },
        { id: "withft", label: "WithFooter", showFooter: true, render: () => null },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Plain/ }));
    expect(screen.queryByText("Save Changes")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /WithFooter/ }));
    const save = screen.getByText("Save Changes").closest("button")!;
    // must NOT be a submit for DetailsTab's form — that form isn't mounted here
    expect(save.getAttribute("type")).toBe("button");
    expect(save.getAttribute("form")).toBeNull();

    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith("row-1", { budget: 250 });
  });

  it("ignores a custom tab that reuses a reserved built-in id", () => {
    renderPanel({
      panelTabs: [
        "details",
        { id: "details", label: "Hijacked", render: () => <div>nope</div> },
      ],
    });

    expect(tabLabels()).toEqual(["Details"]);
    expect(screen.queryByText("nope")).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"details" is reserved'),
    );
  });

  it("defaults to all built-ins when panelTabs is omitted", () => {
    renderPanel({ onAddComment: () => {}, onUploadFile: async () => [] });
    expect(tabLabels()).toEqual(["Details", "Activity", "Files"]);
  });

  // Regression: the active tab used to fall back to a hardcoded "details",
  // so a strip without it rendered an empty body.
  it("falls back to the first available tab, not a hardcoded Details", () => {
    renderPanel({
      onUploadFile: async () => [],
      panelTabs: ["files"],
    });

    expect(tabLabels()).toEqual(["Files"]);
    expect(screen.getByText(/Click to upload or drag & drop/i)).toBeTruthy();
  });

  it("falls back correctly for an all-custom strip", () => {
    renderPanel({
      panelTabs: [{ id: "only", label: "Only", render: () => <div>only body</div> }],
    });

    expect(screen.getByText("only body")).toBeTruthy();
  });
});
