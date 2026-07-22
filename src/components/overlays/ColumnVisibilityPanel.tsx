import React from "react";
import { createPortal } from "react-dom";
import { X, GripVertical } from "lucide-react";
import { cn } from "../../utils";
import { useAnchoredPosition } from "./useAnchoredPosition";
import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  COLUMN VISIBILITY PANEL — show/hide + drag-reorder columns
// ─────────────────────────────────────────────────────────────
export function ColumnVisibilityPanel({
  columns,
  hiddenColumns,
  onToggle,
  onShowAll,
  onReorder,
  onClose,
  anchor,
  isDark,
}: {
  columns: ColumnDef[];
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onReorder: (newOrder: string[]) => void;
  onClose: () => void;
  anchor?: DOMRect | null;
  isDark: boolean;
}) {
  const someHidden = hiddenColumns.size > 0;
  const totalVisible = columns.length - hiddenColumns.size;

  const PANEL_W = 280;
  const PANEL_H = Math.min(480, window.innerHeight * 0.7);
  const panelPos = useAnchoredPosition(anchor ?? null, PANEL_W, PANEL_H);

  // Local order state — initialised from props, dragging updates locally,
  // committed to parent (and localStorage via useGridPersistence) on drop.
  const [order, setOrder] = React.useState<string[]>(() =>
    columns.map((c) => c.key as string),
  );
  // Sync if columns prop changes (e.g. column added/removed)
  React.useEffect(() => {
    setOrder(columns.map((c) => c.key as string));
  }, [columns]);

  const dragKeyRef = React.useRef<string | null>(null);
  const dragOverKeyRef = React.useRef<string | null>(null);

  function handleDragStart(key: string) {
    dragKeyRef.current = key;
  }
  function handleDragOver(e: React.DragEvent, key: string) {
    e.preventDefault();
    dragOverKeyRef.current = key;
  }
  function handleDrop() {
    const from = dragKeyRef.current;
    const to = dragOverKeyRef.current;
    if (!from || !to || from === to) return;
    const next = [...order];
    const fi = next.indexOf(from);
    const ti = next.indexOf(to);
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    setOrder(next);
    onReorder(next);
    dragKeyRef.current = null;
    dragOverKeyRef.current = null;
  }

  const colMap = React.useMemo(() => {
    const m = new Map<string, ColumnDef>();
    columns.forEach((c) => m.set(c.key as string, c));
    return m;
  }, [columns]);

  return createPortal(
    <div
      data-reaktiform
      className={cn(isDark && "dark")}
      style={{ position: "fixed", inset: 0, zIndex: 999 }}
      onClick={onClose}
    >
      <div
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
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--rf-border)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--rf-text-3)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Columns
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--rf-text-1)",
                marginTop: 2,
              }}
            >
              {totalVisible} / {columns.length} visible
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {someHidden && (
              <button
                onClick={onShowAll}
                style={{
                  fontSize: 11.5,
                  color: "var(--rf-accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Show all
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--rf-text-3)",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Drag hint */}
        <div
          style={{
            padding: "6px 16px 4px",
            fontSize: 10.5,
            color: "var(--rf-text-3)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            borderBottom: "1px solid var(--rf-border)",
            background: "var(--rf-header)",
          }}
        >
          <GripVertical style={{ width: 10, height: 10 }} />
          Drag rows to reorder columns
        </div>

        {/* Column list — in current order */}
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "4px 0" }}>
          {order.map((key) => {
            const col = colMap.get(key);
            if (!col) return null;
            const visible = !hiddenColumns.has(key);
            return (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(key)}
                onDragOver={(e) => handleDragOver(e, key)}
                onDrop={handleDrop}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 16px",
                  cursor: "default",
                  background: "transparent",
                  transition: "background 80ms",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--rf-row-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
              >
                {/* Drag handle */}
                <div
                  style={{
                    color: "var(--rf-text-3)",
                    cursor: "grab",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <GripVertical style={{ width: 13, height: 13 }} />
                </div>

                {/* Toggle switch — plain inline CSS, no Tailwind classes that might be missing */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(key);
                  }}
                  style={{
                    position: "relative",
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    flexShrink: 0,
                    cursor: "pointer",
                    transition: "background 150ms",
                    background: visible
                      ? "var(--rf-accent)"
                      : "var(--rf-border)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      left: visible ? 14 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "var(--rf-surface)",
                      boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                      transition: "left 150ms",
                    }}
                  />
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: visible ? "var(--rf-text-1)" : "var(--rf-text-3)",
                    }}
                  >
                    {col.label}
                  </span>
                  {col.computed && (
                    <span style={{ fontSize: 10, color: "var(--rf-text-3)" }}>
                      {col.editableWhenComputed
                        ? "computed · editable"
                        : "computed"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
