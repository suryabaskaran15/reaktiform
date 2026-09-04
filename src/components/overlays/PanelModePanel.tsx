import React from "react";
import { createPortal } from "react-dom";
import { PanelRight, Square, Maximize2, Check } from "lucide-react";
import { cn } from "../../utils";
import { useAnchoredPosition } from "./useAnchoredPosition";
import type { PanelMode } from "../../types";

// ─────────────────────────────────────────────────────────────
//  PANEL MODE PANEL — pick how the detail panel presents itself
//
//  Same shell as ColumnVisibilityPanel/CFPanel: anchored to the toolbar
//  button, portaled to document.body so it escapes the grid's stacking
//  context, with a full-screen backdrop that closes on outside click.
// ─────────────────────────────────────────────────────────────

const MODE_META: Record<
  PanelMode,
  { label: string; hint: string; icon: React.ElementType }
> = {
  drawer: {
    label: "Side drawer",
    hint: "Slides in from the right",
    icon: PanelRight,
  },
  modal: {
    label: "Center modal",
    hint: "Dialog over the table",
    icon: Square,
  },
  page: {
    label: "Full page",
    hint: "Takes over the table",
    icon: Maximize2,
  },
};

const ALL_MODES: PanelMode[] = ["drawer", "modal", "page"];

export function PanelModePanel({
  value,
  modes,
  onSelect,
  onClose,
  anchor,
  isDark,
}: {
  value: PanelMode;
  /** Which modes to offer. Defaults to all three. */
  modes?: PanelMode[] | undefined;
  onSelect: (mode: PanelMode) => void;
  onClose: () => void;
  anchor?: DOMRect | null;
  isDark: boolean;
}) {
  const options = modes?.length ? modes : ALL_MODES;

  const PANEL_W = 240;
  const PANEL_H = Math.min(300, window.innerHeight * 0.7);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelPos = useAnchoredPosition(
    anchor ?? null,
    panelRef,
    PANEL_W,
    PANEL_H,
  );

  return createPortal(
    <div
      data-reaktiform
      className={cn(isDark && "dark")}
      style={{ position: "fixed", inset: 0, zIndex: 999 }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="menu"
        aria-label="Detail panel mode"
        style={{
          ...panelPos,
          width: PANEL_W,
          maxHeight: PANEL_H,
          background: "var(--rf-surface)",
          border: "1px solid var(--rf-border)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(15,23,42,.18)",
          animation: "rfSlideIn .12s ease",
          overflow: "hidden",
          zIndex: 1000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--rf-border)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--rf-text-3)",
          }}
        >
          Record view
        </div>

        <div style={{ padding: 6 }}>
          {options.map((mode) => {
            const meta = MODE_META[mode];
            const Icon = meta.icon;
            const active = mode === value;
            return (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onSelect(mode);
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  textAlign: "left",
                  background: active ? "var(--rf-accent-bg)" : "transparent",
                  color: active ? "var(--rf-accent)" : "var(--rf-text-1)",
                }}
              >
                <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--rf-text-3)",
                    }}
                  >
                    {meta.hint}
                  </span>
                </span>
                {active && (
                  <Check style={{ width: 13, height: 13, flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
