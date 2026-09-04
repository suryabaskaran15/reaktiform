// @vitest-environment jsdom
// src/tests/panelMode.test.tsx
// ─────────────────────────────────────────────────────────────
// Exercises ReaktiformPanel's `mode` prop — the drawer/modal shell
// switch. Only the shell forks per mode, so these tests assert the
// shell (geometry, dialog semantics, Esc, focus) and nothing about
// the panel's interior, which is shared verbatim between modes.
//
// The Tab focus trap is deliberately NOT covered here: it filters
// candidates on `offsetParent !== null`, and jsdom does no layout, so
// every element reads as hidden. It is verified in a real browser.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReaktiformPanel } from "../components/ReaktiformPanel/ReaktiformPanel";
import type { Row } from "../types";

type TestRow = Row<{ id: string; title: string }>;

const row: TestRow = {
  id: "row-1",
  title: "Test row",
  _id: "row-1",
  _saved: true,
  _new: false,
  _draft: null,
  _errors: {},
};

function renderPanel(
  props: Partial<React.ComponentProps<typeof ReaktiformPanel>> = {},
) {
  const utils = render(
    <ReaktiformPanel
      row={row}
      columns={[{ key: "title", label: "Title", type: "text" }]}
      isOpen
      onClose={() => {}}
      onSave={() => {}}
      onDiscard={() => {}}
      {...props}
    />,
  );
  // Scope to this render's own container — a single test may render twice.
  const shell = utils.container.querySelector<HTMLElement>(
    "[data-rf-panel-mode]",
  )!;
  return { ...utils, shell };
}

describe("ReaktiformPanel — presentation mode", () => {
  it("defaults to drawer: right-anchored, full height, no dialog semantics", () => {
    const { shell } = renderPanel();

    expect(shell.dataset["rfPanelMode"]).toBe("drawer");
    expect(shell.style.position).toBe("fixed");
    expect(shell.style.right).toBe("0px");
    expect(shell.style.top).toBe("0px");
    expect(shell.style.bottom).toBe("0px");
    expect(shell.style.width).toBe("440px");
    // Non-modal by design — the grid stays keyboard-usable behind it
    expect(shell.getAttribute("role")).toBeNull();
    expect(shell.getAttribute("aria-modal")).toBeNull();
    expect(shell.getAttribute("tabindex")).toBeNull();
  });

  it("modal mode centers the panel and carries dialog semantics", () => {
    const { shell } = renderPanel({ mode: "modal" });

    expect(shell.dataset["rfPanelMode"]).toBe("modal");
    expect(shell.style.position).toBe("fixed");
    expect(shell.style.left).toBe("50%");
    expect(shell.style.top).toBe("50%");
    expect(shell.style.width).toBe("min(720px, 92vw)");
    expect(shell.style.maxHeight).toBe("85vh");
    expect(shell.getAttribute("role")).toBe("dialog");
    expect(shell.getAttribute("aria-modal")).toBe("true");
    expect(shell.getAttribute("tabindex")).toBe("-1");

    // aria-labelledby must resolve to the visible header title
    const labelledBy = shell.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)?.textContent).toBe(
      "Record Details",
    );
  });

  it("keeps the shell styled without any [data-reaktiform] ancestor", () => {
    // Utility classes are scoped as [data-reaktiform] DESCENDANTS, so a
    // standalone panel can only be styled from the element's own inline
    // styles / CSS vars. Regression guard for that fix.
    const { shell } = renderPanel();
    expect(shell.style.backgroundColor).toBe("var(--rf-surface)");
    expect(shell.style.zIndex).toBe("150");
    expect(shell.style.borderLeft).toBe("1px solid var(--rf-border)");
  });

  it("width prop overrides the per-mode default in both modes", () => {
    expect(renderPanel({ width: 560 }).shell.style.width).toBe("560px");
    expect(renderPanel({ mode: "modal", width: 900 }).shell.style.width).toBe(
      "min(900px, 92vw)",
    );
  });

  it("Escape closes the modal but not the drawer", () => {
    const onCloseModal = vi.fn();
    const { shell: modal } = renderPanel({
      mode: "modal",
      onClose: onCloseModal,
    });
    fireEvent.keyDown(modal, { key: "Escape" });
    expect(onCloseModal).toHaveBeenCalledTimes(1);

    const onCloseDrawer = vi.fn();
    const { shell: drawer } = renderPanel({ onClose: onCloseDrawer });
    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(onCloseDrawer).not.toHaveBeenCalled();
  });

  it("moves focus into the modal on open and restores it on close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender, shell } = renderPanel({ mode: "modal" });
    expect(document.activeElement).toBe(shell);

    rerender(
      <ReaktiformPanel
        row={row}
        columns={[{ key: "title", label: "Title", type: "text" }]}
        mode="modal"
        isOpen={false}
        onClose={() => {}}
        onSave={() => {}}
        onDiscard={() => {}}
      />,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("never steals focus in drawer mode", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    renderPanel();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("closes on backdrop click in both modes", () => {
    for (const mode of ["drawer", "modal"] as const) {
      const onClose = vi.fn();
      const { container } = renderPanel({ mode, onClose });
      fireEvent.click(container.querySelector("div")!);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});
