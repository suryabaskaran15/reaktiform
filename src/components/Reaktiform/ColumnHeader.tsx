import React, { useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Pin,
  PinOff,
  Group,
} from "lucide-react";
import { cn } from "../../utils";
import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  COLUMN HEADER (2-row layout)
// ─────────────────────────────────────────────────────────────
export type ColumnHeaderProps = {
  col: ColumnDef;
  isPinned: boolean;
  isLastPin: boolean;
  isSorted: boolean;
  sortDir?: "asc" | "desc" | undefined;
  isFiltered: boolean;
  isGrouped: boolean;
  isDragOver: boolean;
  aggregationMode?: string | undefined;
  pinOffset?: number | undefined;
  onSort?: ((e: React.MouseEvent) => void) | undefined;
  sortPriority?: number; // position in multi-sort stack (1-based), undefined = not in stack
  onTogglePin: () => void;
  onToggleGroup: () => void;
  onOpenFilter?: ((btn: HTMLButtonElement) => void) | undefined;
  onResize?: ((width: number) => void) | undefined;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onCycleAggregation?: (() => void) | undefined;
};

function ColumnHeader({
  col,
  isPinned,
  isLastPin,
  isSorted,
  sortDir,
  isFiltered,
  isGrouped,
  isDragOver,
  aggregationMode,
  pinOffset,
  onSort,
  sortPriority,
  onTogglePin,
  onToggleGroup,
  onOpenFilter,
  onResize,
  onDragStart,
  onDragOver,
  onDragEnd,
  onCycleAggregation,
}: ColumnHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const lastResizeCall = useRef(0);
  // Controls whether the <th> is draggable — only true while over the drag handle
  const [draggable, setDraggable] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // ← prevents any pending dragstart
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = thRef.current?.offsetWidth ?? 0;

    const onMove = (me: MouseEvent) => {
      if (!resizing.current) return;
      const w = Math.max(60, startW.current + (me.clientX - startX.current));

      // 1. Update <th> via direct DOM — no React re-render cost
      if (thRef.current) thRef.current.style.width = `${w}px`;

      // 2. Keep <col> in sync
      const table = thRef.current?.closest("table");
      const thIndex = thRef.current
        ? Array.from(thRef.current.parentElement?.children ?? []).indexOf(
            thRef.current,
          )
        : -1;
      if (table && thIndex >= 0) {
        const colEl = table.querySelector(
          `colgroup col:nth-child(${thIndex + 1})`,
        ) as HTMLElement | null;
        if (colEl) colEl.style.width = `${w}px`;
      }

      // 3. Throttle Zustand to ~60fps
      const now = Date.now();
      if (now - lastResizeCall.current >= 16) {
        lastResizeCall.current = now;
        onResize?.(w);
      }
    };

    const onUp = (me: MouseEvent) => {
      resizing.current = false;
      const w = Math.max(60, startW.current + (me.clientX - startX.current));
      onResize?.(w);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const SortIcon = isSorted
    ? sortDir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  const sortTooltip = !isSorted
    ? "Click to sort ascending"
    : sortDir === "asc"
      ? "Sorted ascending — click for descending"
      : "Sorted descending — click to clear sort";

  return (
    <th
      ref={thRef}
      // draggable is only true when the cursor is over the drag handle (⠿ grip)
      // so resizing never accidentally triggers column reorder
      draggable={draggable}
      onDragStart={(e) => {
        if (resizing.current) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      className={cn(
        "border-b-2 border-r border-rf-border h-[64px] font-medium select-none",
        "text-rf-text-2 text-left relative",
        isPinned && "sticky z-[45]",
        isLastPin && "shadow-[4px_0_10px_rgba(15,23,42,.08)]",
        isSorted && "bg-rf-header-sorted",
        isFiltered && !isSorted && "bg-rf-accent-bg",
        isGrouped && "bg-rf-purple-bg",
        !isSorted && !isFiltered && !isGrouped && "bg-rf-header",
        isDragOver &&
          "outline outline-2 outline-rf-accent outline-offset-[-2px]",
      )}
      style={
        isPinned && pinOffset !== undefined ? { left: pinOffset } : undefined
      }
    >
      {/* Top row — drag handle + label + sort
          The ⠿ grip icon on the LEFT is the ONLY draggable zone.
          Hovering it sets draggable=true on the <th>.
          Leaving it (or starting a resize) sets draggable=false.
          This mirrors Google Sheets behaviour exactly.             */}
      <div className="rf-flex rf-items-center h-[36px] px-[10px] rf-gap-1">
        {/* Drag grip — only this activates column reorder */}
        <div
          className="rf-flex-shrink-0 cursor-grab active:cursor-grabbing text-rf-text-3 opacity-0 group-hover:rf-opacity-60 hover:!opacity-100 transition-opacity mr-0.5"
          style={{ lineHeight: 1 }}
          onMouseEnter={() => setDraggable(true)}
          onMouseLeave={() => {
            if (!resizing.current) setDraggable(false);
          }}
          title="Drag to reorder column"
        >
          {/* 6-dot grip icon — pure SVG, no extra dep */}
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
            <circle cx="2.5" cy="2.5" r="1.4" />
            <circle cx="7.5" cy="2.5" r="1.4" />
            <circle cx="2.5" cy="7" r="1.4" />
            <circle cx="7.5" cy="7" r="1.4" />
            <circle cx="2.5" cy="11.5" r="1.4" />
            <circle cx="7.5" cy="11.5" r="1.4" />
          </svg>
        </div>

        {/* Label + sort — clicking here sorts (when onSort is provided, i.e. col.sortable !== false) */}
        <div
          className={cn(
            "rf-flex-1 rf-flex rf-items-center rf-gap-1 rf-min-w-0 transition-opacity",
            onSort && "rf-cursor-pointer hover:opacity-80",
          )}
          onClick={onSort}
          title={
            onSort
              ? `${sortTooltip} · Shift+click for multi-column sort`
              : undefined
          }
        >
          <span
            className={cn(
              "flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
              "uppercase tracking-[.04em] text-[10.5px] font-semibold",
              isSorted && "text-rf-accent",
              isGrouped && "text-rf-purple",
            )}
          >
            {col.label}
          </span>
          {col.required && (
            <span
              className="text-rf-err text-[12px] rf-font-bold rf-flex-shrink-0 -mt-px"
              title="Required"
            >
              *
            </span>
          )}
          {col.computed && (
            <span className="text-[9px] rf-font-bold text-rf-text-3 border border-rf-border rounded px-1 rf-flex-shrink-0">
              fx
            </span>
          )}
          {onSort && (
            <SortIcon
              className={cn(
                "w-[11px] h-[11px] flex-shrink-0 transition-opacity",
                isSorted
                  ? "opacity-100 text-rf-accent"
                  : "opacity-0 hover:opacity-100",
              )}
            />
          )}
          {/* Multi-sort priority badge — shown when >1 sort active */}
          {sortPriority !== undefined && sortPriority > 0 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
                background: "var(--rf-accent)",
                color: "#fff",
                borderRadius: "50%",
                width: 14,
                height: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {sortPriority}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row — controls */}
      <div className="rf-flex rf-items-center gap-0.5 h-[28px] px-2 border-t border-rf-border bg-black/[.015]">
        {/* Filter */}
        {onOpenFilter && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFilter(e.currentTarget as HTMLButtonElement);
              }}
              className={cn(
                "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
                isFiltered
                  ? "text-rf-accent bg-rf-accent-bg"
                  : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
              )}
              title={isFiltered ? "Edit filter" : "Add filter"}
            >
              <Filter className="w-[11px] h-[11px]" />
            </button>

            <div className="w-px rf-icon-sm bg-rf-border mx-[1px] rf-flex-shrink-0" />
          </>
        )}

        {/* Pin */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
            isPinned
              ? "text-rf-accent bg-rf-accent-bg"
              : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
          )}
          title={isPinned ? "Unpin column" : "Pin column"}
        >
          {isPinned ? (
            <PinOff className="w-[11px] h-[11px]" />
          ) : (
            <Pin className="w-[11px] h-[11px]" />
          )}
        </button>

        {/* Group */}
        {col.groupable && (
          <>
            <div className="w-px rf-icon-sm bg-rf-border mx-[1px] rf-flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleGroup();
              }}
              className={cn(
                "w-5 h-5 rounded-[3px] flex items-center justify-center transition-colors",
                isGrouped
                  ? "text-rf-purple bg-rf-purple-bg"
                  : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 hover:shadow-rf-sm",
              )}
              title={isGrouped ? "Remove grouping" : "Group by this column"}
            >
              <Group className="w-[11px] h-[11px]" />
            </button>
          </>
        )}

        {/* Aggregation cycle (number columns only) */}
        {col.type === "number" && !col.computed && onCycleAggregation && (
          <>
            <div className="w-px rf-icon-sm bg-rf-border mx-[1px] rf-flex-shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCycleAggregation();
              }}
              className={cn(
                "h-5 rounded-[3px] flex items-center justify-center transition-colors px-1",
                aggregationMode && aggregationMode !== "none"
                  ? "text-rf-accent bg-rf-accent-bg text-[9px] font-bold uppercase tracking-[.04em]"
                  : "text-rf-text-3 hover:bg-rf-surface hover:text-rf-text-1 text-[9px] hover:shadow-rf-sm",
              )}
              title={`Aggregation: ${aggregationMode ?? "none"} — click to cycle`}
            >
              {aggregationMode && aggregationMode !== "none"
                ? aggregationMode
                : "Σ"}
            </button>
          </>
        )}

        {/* Resize handle — RIGHT edge, pointer changes to col-resize */}
        <div className="rf-flex-1" />
        {onResize && (
          <div
            className="w-[6px] rf-h-full rf-flex rf-items-center rf-justify-center cursor-col-resize group/resize rf-flex-shrink-0"
            onMouseDown={(e) => {
              // Disable drag while resizing so th.draggable can't fire
              setDraggable(false);
              handleResizeStart(e);
            }}
            onMouseEnter={() => setDraggable(false)}
          >
            <div className="w-[2px] h-[14px] bg-rf-border-strong rounded-sm group-hover/resize:bg-rf-accent rf-transition-colors" />
          </div>
        )}
      </div>
    </th>
  );
}

// Memoize ColumnHeader — it renders N times (one per column) and re-renders
// on every scroll event because the parent virtualizer fires. With React.memo
// it only re-renders when its own props change (sort/filter/pin state etc.)
// This is the single biggest scroll-performance win in the entire component.
export const ColumnHeaderMemo = React.memo(ColumnHeader);
