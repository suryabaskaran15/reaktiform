import React from "react";
import { useGridStore, useGridStoreInstance } from "../../store";
import { CellRenderer, mergedRow } from "../cells/CellRenderer";
import { ErrorPopover } from "../overlays/ErrorPopover";
import { ChevronRight, Save, X, Copy, Trash2 } from "lucide-react";
import type { Row, ColumnDef } from "../../types";
import type { GridApi } from "./types";

// ─────────────────────────────────────────────────────────────
//  GRID ROW — one <tr> of grid data, extracted from Reaktiform.tsx
//  as a React.memo boundary.
//
//  This is a verbatim transplant of the "DATA ROW" JSX that used to
//  live inline in ReaktiformInner's virtualItems.map() — same
//  conditions, same z-index/boxShadow values, same event handlers.
//  Row-scoped booleans that used to come from a single broad parent
//  read (grid.selectedIds, kb.kbFocusRowId, grid.panelRowId,
//  grid.editLocked, editingCell) are now read via granular per-row
//  useGridStore selectors instead — the mechanism that lets
//  React.memo actually bail out for rows that didn't change.
//
//  Group-header rows, unloaded-skeleton rows, and the virtualizer's
//  top/bottom padding rows are NOT part of this component — they
//  stay in ReaktiformInner's map callback, unchanged. ReaktiformInner
//  also still owns whether to wrap this row in the expanded-content
//  React.Fragment (needs expandedRowIds, already local there).
// ─────────────────────────────────────────────────────────────

type GridRowProps<TData> = {
  row: Row<TData>;
  rowIndex: number;
  columns: ColumnDef<TData>[]; // visibleDataCols — already filtered/ordered
  columnWidths: Record<string, number>; // grid.columnWidths — per-column resize overrides
  pinOffsets: Record<string, number>;
  lastPinKey: string | undefined;
  showSelectColumn: boolean;
  showRowNumbers: boolean;
  showExpanderColumn: boolean;
  showActionsColumn: boolean;
  selectionMode: "multi" | "single" | "none";
  colWidths: { cb: number; rn: number; exp: number; act: number };
  rowHeight: number;
  activeCellRef: React.MutableRefObject<HTMLTableCellElement | null>;
  expandedRowIds: Set<string>;
  toggleExpandedRow: (rowId: string) => void;
  hasRenderExpandedRow: boolean;
  isErrorPopoverOpen: boolean;
  onToggleErrorPopover: (rowId: string) => void;
  onCloseErrorPopover: () => void;
  isDisabled: boolean;
  extraClass: string | undefined;
  extraStyle: React.CSSProperties | undefined;
  isDark: boolean;
  onRowClick: ((row: TData) => void) | undefined;
  onRowDoubleClick: ((row: TData) => void) | undefined;
  isRowSelectable: ((row: TData) => boolean) | undefined;
  onSelectionChange: ((ids: string[], rows: TData[]) => void) | undefined;
  // Stage 4 will swap these for ref-stabilized wrappers at the call site —
  // the prop types here don't change, only what ReaktiformInner passes in.
  markDirty: GridApi<TData>["markDirty"];
  discardRow: GridApi<TData>["discardRow"];
  duplicateRow: GridApi<TData>["duplicateRow"];
  saveRow: GridApi<TData>["saveRow"];
  deleteRow: GridApi<TData>["deleteRow"];
  getComputedValue: GridApi<TData>["getComputedValue"];
  canDuplicateRow: GridApi<TData>["permissions"]["canDuplicateRow"];
  canDeleteRow: GridApi<TData>["permissions"]["canDeleteRow"];
  canSave: boolean;
  canEditCell: (row: Row<TData>, col: ColumnDef<TData>) => boolean;
  // Already-stable — passed straight through
  setFocus: (rowId: string | null, colIdx: number | null) => void;
  deactivateCell: () => void;
  openPanel: (rowId: string) => void;
  closePanel: () => void;
  evalCF: GridApi<TData>["evalCF"];
  getVal: GridApi<TData>["getVal"];
  activateCellIfAllowed: (rowId: string, colKey: string) => void;
  toggleSelect: (rowId: string) => void;
  clearSelection: () => void;
};

function GridRowImpl<TData>({
  row,
  rowIndex,
  columns: visibleDataCols,
  columnWidths,
  pinOffsets,
  lastPinKey,
  showSelectColumn,
  showRowNumbers,
  showExpanderColumn,
  showActionsColumn,
  selectionMode,
  colWidths: COL_WIDTHS,
  rowHeight: ROW_HEIGHT,
  activeCellRef,
  expandedRowIds,
  toggleExpandedRow,
  hasRenderExpandedRow,
  isErrorPopoverOpen,
  onToggleErrorPopover,
  onCloseErrorPopover,
  isDisabled,
  extraClass,
  extraStyle,
  isDark,
  onRowClick,
  onRowDoubleClick,
  isRowSelectable,
  onSelectionChange,
  markDirty,
  discardRow,
  duplicateRow,
  saveRow,
  deleteRow,
  getComputedValue,
  canDuplicateRow,
  canDeleteRow,
  canSave,
  canEditCell,
  setFocus,
  deactivateCell,
  openPanel,
  closePanel,
  evalCF,
  getVal,
  activateCellIfAllowed,
  toggleSelect,
  clearSelection,
}: GridRowProps<TData>) {
  const rowId = row._id;

  // ── Row-scoped store selectors — each only re-renders THIS row when
  // its own membership/focus/edit/lock state changes, not on every
  // grid-wide selection/keyboard/edit-lock/editing-cell change.
  const isSelected = useGridStore((s) => s.selectedIds.has(rowId));
  const isKbFocused = useGridStore((s) => s.kbFocusRowId === rowId);
  const kbFocusColIdxForRow = useGridStore((s) =>
    s.kbFocusRowId === rowId ? s.kbFocusColIdx : null,
  );
  const isPanelOpen = useGridStore((s) => s.panelRowId === rowId);
  const editLocked = useGridStore((s) => s.editLocked);
  const editingColKey = useGridStore((s) =>
    s.editingCell?.rowId === rowId ? s.editingCell.colKey : null,
  );

  // Imperative (non-reactive) store access — used only for two event-time
  // reads below (current global kbFocusColIdx on row click; current
  // selectedIds/rows snapshot for onSelectionChange), neither of which
  // should force this row to re-render when they change elsewhere.
  const storeInstance = useGridStoreInstance();

  const isDirty = row._draft !== null;
  const hasErrors = Object.keys(row._errors ?? {}).length > 0;
  const cfResult = evalCF(row);

  const rowStyle: React.CSSProperties = {
    height: ROW_HEIGHT,
    borderBottom: "1px solid var(--rf-border)",
    ...(isDirty
      ? {
          background: "var(--rf-row-dirty)",
          borderLeft: "3px solid var(--rf-row-dirty-border)",
        }
      : hasErrors
        ? { borderLeft: "3px solid var(--rf-err)" }
        : row._new
          ? { borderLeft: "3px solid var(--rf-ok)" }
          : isSelected
            ? { background: "var(--rf-row-selected)" }
            : cfResult && !isDirty && !hasErrors
              ? {
                  background: cfResult.backgroundColor,
                  color: cfResult.textColor,
                }
              : {}),
    ...(isKbFocused
      ? {
          outline: "2px solid var(--rf-accent)",
          outlineOffset: "-2px",
        }
      : {}),
  };

  // Consumer row props
  const consumerRowData = row as unknown as TData;

  return (
    <tr
      key={rowId}
      data-row-id={rowId}
      data-disabled={isDisabled || undefined}
      style={{
        ...rowStyle,
        ...extraStyle,
        ...(isDisabled
          ? {
              opacity: 0.45,
              pointerEvents: "none",
              userSelect: "none",
            }
          : {}),
      }}
      className={extraClass}
      onMouseEnter={(e) => {
        if (!isDirty && !isSelected && !isDisabled)
          (e.currentTarget as HTMLElement).style.background =
            "var(--rf-row-hover)";
      }}
      onMouseLeave={(e) => {
        const base = isDirty
          ? "var(--rf-row-dirty)"
          : isSelected
            ? "var(--rf-row-selected)"
            : cfResult && !isDirty && !hasErrors
              ? cfResult.backgroundColor
              : "";
        (e.currentTarget as HTMLElement).style.background = base;
      }}
      onClick={(e) => {
        if (isDisabled) return;
        setFocus(rowId, storeInstance.getState().kbFocusColIdx ?? 0);
        // Fire consumer row click if the click wasn't on a cell/button
        const target = e.target as HTMLElement;
        if (target.tagName !== "BUTTON" && target.tagName !== "INPUT") {
          onRowClick?.(consumerRowData);
        }
      }}
      onDoubleClick={() => {
        if (isDisabled) return;
        onRowDoubleClick?.(consumerRowData);
      }}
    >
      {/* Checkbox — optional */}
      {showSelectColumn && (
        <td
          style={{
            width: COL_WIDTHS.cb,
            padding: 0,
            borderRight: "1px solid var(--rf-border)",
            background: isDirty ? "var(--rf-row-dirty)" : "var(--rf-surface)",
            position: "sticky",
            left: pinOffsets["_cb"] ?? 0,
            zIndex: 20,
            textAlign: "center",
            verticalAlign: "middle",
          }}
        >
          <input
            type={selectionMode === "single" ? "radio" : "checkbox"}
            checked={isSelected}
            disabled={
              isRowSelectable ? !isRowSelectable(consumerRowData) : false
            }
            onChange={() => {
              if (isRowSelectable && !isRowSelectable(consumerRowData)) return;
              if (selectionMode === "single") {
                clearSelection();
                if (!isSelected) toggleSelect(rowId);
              } else {
                toggleSelect(rowId);
              }
              if (onSelectionChange) {
                const currentSelected = storeInstance.getState().selectedIds;
                const newIds =
                  selectionMode === "single"
                    ? isSelected
                      ? []
                      : [rowId]
                    : isSelected
                      ? [...currentSelected].filter((id) => id !== rowId)
                      : [...currentSelected, rowId];
                const allRows = storeInstance.getState()
                  .rows as unknown as Row<TData>[];
                const newRows = newIds
                  .map((id) => allRows.find((r) => r._id === id))
                  .filter(Boolean) as Row<TData>[];
                requestAnimationFrame(() =>
                  onSelectionChange(newIds, newRows as unknown as TData[]),
                );
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 14,
              height: 14,
              accentColor: "var(--rf-accent)",
              cursor: "pointer",
            }}
          />
        </td>
      )}

      {/* Row # + state dot — optional */}
      {showRowNumbers && (
        <td
          style={{
            width: COL_WIDTHS.rn,
            padding: 0,
            borderRight: "1px solid var(--rf-border)",
            background: isDirty
              ? "var(--rf-row-dirty)"
              : isSelected
                ? "var(--rf-row-selected)"
                : cfResult
                  ? cfResult.backgroundColor
                  : "var(--rf-surface)",
            position: "sticky",
            left: pinOffsets["_rn"] ?? 40,
            zIndex: 20,
            verticalAlign: "middle",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              height: "100%",
              position: "relative",
            }}
          >
            {/* State dot — click to open error popover.
            Shows for both validation errors AND API save errors. */}
            {hasErrors || row._saveError ? (
              <button
                data-error-dot={rowId}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleErrorPopover(rowId);
                }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "var(--rf-err)",
                  border: "2px solid var(--rf-err-br)",
                  cursor: "pointer",
                  padding: 0,
                  animation: "rf-pulse 2s ease-in-out infinite",
                }}
                title={
                  row._saveError
                    ? "Save failed — click to see error"
                    : "Click to see validation errors"
                }
              />
            ) : (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isDirty
                    ? "var(--rf-row-dirty-border)"
                    : row._new
                      ? "var(--rf-text-3)"
                      : "var(--rf-ok)",
                }}
                title={isDirty ? "Unsaved" : row._new ? "New" : "Saved"}
              />
            )}
            <span
              style={{
                fontSize: 11,
                color: "var(--rf-text-3)",
                fontFamily: "var(--rf-font-mono)",
              }}
            >
              {rowIndex + 1}
            </span>

            {/* Error popover — shows validation errors AND API save errors */}
            {isErrorPopoverOpen && (hasErrors || row._saveError) && (
              <ErrorPopover
                rowId={rowId}
                errors={row._errors ?? {}}
                saveError={row._saveError}
                columns={visibleDataCols as ColumnDef[]}
                onClose={onCloseErrorPopover}
                isDark={isDark}
              />
            )}
          </div>
        </td>
      )}

      {/* Expander — optional */}
      {showExpanderColumn && (
        <td
          style={{
            width: COL_WIDTHS.exp,
            padding: 0,
            borderRight: "1px solid var(--rf-border)",
            background: isDirty
              ? "var(--rf-row-dirty)"
              : isSelected
                ? "var(--rf-row-selected)"
                : cfResult
                  ? cfResult.backgroundColor
                  : "var(--rf-surface)",
            position: "sticky",
            left: pinOffsets["_exp"] ?? 84,
            zIndex: 20,
            textAlign: "center",
            verticalAlign: "middle",
            boxShadow: !lastPinKey
              ? "4px 0 10px rgba(15,23,42,.08)"
              : undefined,
          }}
        >
          {hasRenderExpandedRow ? (
            // Inline expand mode — chevron rotates when open
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpandedRow(rowId);
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `1px solid ${expandedRowIds.has(rowId) ? "var(--rf-accent)" : "var(--rf-border)"}`,
                background: expandedRowIds.has(rowId)
                  ? "var(--rf-accent-bg)"
                  : "transparent",
                color: expandedRowIds.has(rowId)
                  ? "var(--rf-accent)"
                  : "var(--rf-text-3)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 120ms ease",
              }}
              title={expandedRowIds.has(rowId) ? "Collapse row" : "Expand row"}
            >
              <ChevronRight
                style={{
                  width: 11,
                  height: 11,
                  transform: expandedRowIds.has(rowId)
                    ? "rotate(90deg)"
                    : "rotate(0deg)",
                  transition: "transform 150ms ease",
                }}
              />
            </button>
          ) : (
            // Detail panel mode — opens side panel
            <button
              onClick={(e) => {
                e.stopPropagation();
                isPanelOpen ? closePanel() : openPanel(rowId);
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `1px solid ${isPanelOpen ? "var(--rf-accent)" : "var(--rf-border)"}`,
                background: isPanelOpen ? "var(--rf-accent)" : "transparent",
                color: isPanelOpen ? "#fff" : "var(--rf-text-3)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Open detail panel"
            >
              <ChevronRight style={{ width: 11, height: 11 }} />
            </button>
          )}
        </td>
      )}

      {/* Data cells */}
      {visibleDataCols.map((col, cIdx) => {
        const colKey = col.key as string;
        const colWidth = columnWidths[colKey] ?? col.width ?? 150;
        const isPinned = pinOffsets[colKey] !== undefined;
        const isLastPinCol = lastPinKey === colKey;
        const isEditing = editingColKey === colKey;
        // Resolve readOnly — supports boolean or (row) => boolean.
        // Edit Lock also dims every cell (not just readOnly columns) as
        // the "loud" visual signal that the whole grid is temporarily
        // locked.
        const rowData_ = mergedRow<TData>(row);
        const isReadOnly =
          editLocked ||
          col.readOnly === true ||
          (typeof col.readOnly === "function" && col.readOnly(rowData_));
        const isKbCell = isKbFocused && kbFocusColIdxForRow === cIdx;
        const cellVal = getVal(row, colKey);
        const computedVal = col.computed
          ? getComputedValue(row, colKey)
          : undefined;

        // For editableWhenComputed: when editing use the draft/committed
        // value so the user sees what they typed. When reading, use the
        // formula result.
        const fieldValue =
          col.computed && col.editableWhenComputed
            ? isEditing
              ? cellVal
              : (computedVal ?? cellVal)
            : col.computed
              ? computedVal
              : cellVal;

        const errMsg = row._errors?.[colKey];
        const hasErr = !!errMsg;

        // Compute the cell's background — must be explicit (not
        // undefined/transparent) for ALL cells so non-pinned cells act as
        // opaque barriers when scrolling horizontally past sticky pinned
        // columns.
        const cellBg = isEditing
          ? "var(--rf-accent-bg)"
          : isDirty
            ? "var(--rf-row-dirty)"
            : isSelected
              ? "var(--rf-row-selected)"
              : cfResult
                ? cfResult.backgroundColor
                : "var(--rf-surface)";

        return (
          <td
            key={colKey}
            style={{
              width: colWidth,
              padding: 0,
              height: ROW_HEIGHT,
              verticalAlign: "middle",
              position: isPinned ? "sticky" : undefined,
              left: isPinned ? pinOffsets[colKey] : undefined,
              // Pinned cells always win over all non-pinned cells.
              // Non-pinned editing/focused cells use lower z-index so they
              // never visually overlap the sticky column.
              zIndex: isPinned ? 20 : isEditing ? 18 : isKbCell ? 15 : undefined,
              // Every cell has an explicit opaque background. Without this,
              // transparent cells bleed text over sticky pinned cols.
              background: cellBg,
              outline: isEditing
                ? "2px solid var(--rf-accent)"
                : isKbCell && !isEditing
                  ? "2px solid var(--rf-accent-br)"
                  : undefined,
              outlineOffset: isEditing || isKbCell ? "-2px" : undefined,
              // Subtle visual cue: read-only cells are slightly dimmed
              opacity: isReadOnly ? 0.72 : undefined,
              boxShadow:
                hasErr && !isEditing
                  ? "inset 0 0 0 2px var(--rf-err)"
                  : isLastPinCol
                    ? "4px 0 10px rgba(15,23,42,.08)"
                    : undefined,
              borderRight: "1px solid var(--rf-border)",
              overflow: "hidden",
              cursor: canEditCell(row, col) ? "text" : "default",
            }}
            ref={isEditing ? activeCellRef : undefined}
            onClick={() => {
              // Only (re)activate when this cell isn't already the one
              // being edited — re-firing activateCell on every click of an
              // already-open editor is what let the container's old
              // unconditional deactivate "win" the race and close cells
              // that should have stayed open (e.g. clicking mid-text to
              // place the cursor).
              if (!isEditing) {
                activateCellIfAllowed(rowId, colKey);
              }
              setFocus(rowId, cIdx);
            }}
          >
            <CellRenderer
              row={row}
              colDef={col as ColumnDef}
              value={fieldValue}
              isEditing={isEditing}
              isError={hasErr}
              onCommit={(val) => {
                markDirty(rowId, colKey, val);
                deactivateCell();
              }}
              onCancel={deactivateCell}
              {...(computedVal !== undefined && { computedValue: computedVal })}
              {...(errMsg !== undefined && { errorMessage: errMsg })}
              className={col?.cellClassName?.(fieldValue, row)}
            />
          </td>
        );
      })}

      {/* Row Actions — optional */}
      {showActionsColumn && (
        <td
          style={{
            padding: 0,
            verticalAlign: "middle",
            textAlign: "center",
          }}
          className="rf-actions-cell"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              height: "100%",
            }}
          >
            {isDirty ? (
              <>
                {/* Save error — shown as pulsing dot in the row number
                column. Click the dot to see the full API error message in
                the popover. */}
                {canSave && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!row._saving) void saveRow(rowId);
                    }}
                    disabled={!!row._saving}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "var(--rf-ok-bg)",
                      color: "#15803D",
                      border: "1px solid var(--rf-ok-br)",
                      cursor: row._saving ? "not-allowed" : "pointer",
                      opacity: row._saving ? 0.65 : 1,
                      fontFamily: "inherit",
                    }}
                    title={row._saving ? "Saving…" : "Save changes"}
                  >
                    {row._saving ? (
                      <>
                        <svg
                          style={{
                            width: 11,
                            height: 11,
                            animation: "rf-spin 0.8s linear infinite",
                          }}
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray="32"
                            strokeDashoffset="12"
                            strokeLinecap="round"
                          />
                        </svg>
                        Saving
                      </>
                    ) : (
                      <>
                        <Save style={{ width: 11, height: 11 }} /> Save
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    discardRow(rowId);
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: "var(--rf-err-bg)",
                    color: "var(--rf-err)",
                    border: "1px solid var(--rf-err-br)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Discard changes"
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </>
            ) : (
              /* Show duplicate/delete only on row hover via CSS class */
              <div className="rf-row-actions">
                {canDuplicateRow(row as Record<string, unknown>) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateRow(rowId);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: "1px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--rf-text-3)",
                    }}
                    title="Duplicate"
                    onMouseEnter={(e) => {
                      const b = e.currentTarget;
                      b.style.background = "var(--rf-header)";
                      b.style.borderColor = "var(--rf-border)";
                      b.style.color = "var(--rf-text-1)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget;
                      b.style.background = "transparent";
                      b.style.borderColor = "transparent";
                      b.style.color = "var(--rf-text-3)";
                    }}
                  >
                    <Copy style={{ width: 12, height: 12 }} />
                  </button>
                )}
                {canDeleteRow(row as Record<string, unknown>) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteRow(rowId);
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: "1px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--rf-text-3)",
                    }}
                    title="Delete"
                    onMouseEnter={(e) => {
                      const b = e.currentTarget;
                      b.style.background = "var(--rf-err-bg)";
                      b.style.borderColor = "var(--rf-err-br)";
                      b.style.color = "var(--rf-err)";
                    }}
                    onMouseLeave={(e) => {
                      const b = e.currentTarget;
                      b.style.background = "transparent";
                      b.style.borderColor = "transparent";
                      b.style.color = "var(--rf-text-3)";
                    }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export const GridRow = React.memo(GridRowImpl) as typeof GridRowImpl;
