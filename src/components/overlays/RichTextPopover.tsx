import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils";
import { useAnchoredPosition } from "./useAnchoredPosition";
import { RichTextEditor } from "../richtext/RichTextEditor";

// ─────────────────────────────────────────────────────────────
//  RICHTEXT POPOVER — anchored floating editor for the grid's richtext
//  cell. A <td> is too small to host a WYSIWYG toolbar + multi-paragraph
//  editor, so editing happens here instead, positioned via the same
//  useAnchoredPosition + createPortal(document.body) + backdrop pattern
//  already used by CFPanel/ColumnVisibilityPanel.
//
//  Edits are buffered in local state and only committed via the explicit
//  Save button — not per keystroke and not on blur, since clicking a
//  toolbar button inside the editor blurs the ProseMirror surface
//  constantly, and committing per keystroke would spam markDirty/undo
//  history for every character typed.
//
//  z-index 9997/9998: above the panel-family overlays (900/999/149/150)
//  and the keyboard-hint toast (800); below react-select's forced 9999
//  menu portal and well below ErrorPopover's 99998/99999 tier (a
//  save-blocking surface stays visually dominant if both are open).
//
//  `data-rf-richtext-popover` on the portal root is the outside-click
//  fix's defense-in-depth hook — see Reaktiform.tsx's container onClick.
//
//  Size is local component state (not persisted) — resizable via the
//  bottom-right corner drag handle, same mousedown/mousemove/mouseup
//  pattern as ColumnHeader.tsx's column-width drag, adapted to two axes.
// ─────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 400;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 280;
const VIEWPORT_MARGIN = 16;

export function RichTextPopover({
  anchor,
  initialValue,
  onCommit,
  onCancel,
  isDark,
  minHeight,
  placeholder,
}: {
  anchor: DOMRect;
  initialValue: string;
  onCommit: (html: string) => void;
  onCancel: () => void;
  isDark: boolean;
  minHeight?: number | undefined;
  placeholder?: string | undefined;
}) {
  const [html, setHtml] = useState(initialValue);
  const [size, setSize] = useState({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(anchor, panelRef, size.width, size.height);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const maxW = window.innerWidth - VIEWPORT_MARGIN * 2;
    const maxH = window.innerHeight - VIEWPORT_MARGIN * 2;
    // Prevent text-selection flicker elsewhere on the page while dragging.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMove = (me: MouseEvent) => {
      const w = Math.min(
        maxW,
        Math.max(MIN_WIDTH, startW + (me.clientX - startX)),
      );
      const h = Math.min(
        maxH,
        Math.max(MIN_HEIGHT, startH + (me.clientY - startY)),
      );
      setSize({ width: w, height: h });
    };
    const onUp = () => {
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return createPortal(
    <div
      data-reaktiform
      data-rf-richtext-popover
      className={cn(isDark && "dark")}
      style={{ position: "fixed", inset: 0, zIndex: 9997 }}
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        style={{
          ...pos,
          width: size.width,
          height: size.height,
          maxWidth: `calc(100vw - ${VIEWPORT_MARGIN}px)`,
          maxHeight: `calc(100vh - ${VIEWPORT_MARGIN}px)`,
          background: "var(--rf-surface)",
          border: "1px solid var(--rf-border)",
          borderRadius: "var(--rf-radius-lg)",
          boxShadow: "0 8px 40px rgba(15,23,42,.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--rf-font-sans)",
          zIndex: 9998,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* min-height:0 lets this flex child actually shrink instead of
            being pushed to its content's natural size — the flex-item
            default min-height is `auto`, not 0. overflow:hidden because
            RichTextEditor now owns its own internal scroll container
            (toolbar stays pinned, only the text area scrolls). */}
        <div style={{ padding: 10, overflow: "hidden", flex: 1, minHeight: 0 }}>
          <RichTextEditor
            value={html}
            onChange={setHtml}
            minHeight={minHeight ?? 160}
            {...(placeholder !== undefined && { placeholder })}
          />
        </div>

        {/* Footer — explicit Save/Cancel, never commit-on-blur */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid var(--rf-border)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: 7,
              border: "1px solid var(--rf-border)",
              background: "var(--rf-surface)",
              color: "var(--rf-text-2)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCommit(html)}
            style={{
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 7,
              border: "none",
              background: "var(--rf-accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>

        {/* Resize handle — bottom-right corner drag, both axes */}
        <div
          onMouseDown={handleResizeStart}
          title="Drag to resize"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: 3,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: 0.5 }}>
            <circle cx="7" cy="7" r="1" fill="var(--rf-text-3)" />
            <circle cx="7" cy="4" r="1" fill="var(--rf-text-3)" />
            <circle cx="4" cy="7" r="1" fill="var(--rf-text-3)" />
          </svg>
        </div>
      </div>
    </div>,
    document.body,
  );
}
