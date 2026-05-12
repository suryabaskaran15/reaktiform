"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn, resolveConstraint } from "../../utils";
import { GridStoreProvider } from "../../store";
import { useReaktiform } from "../../hooks/useReaktiform";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { CellRenderer } from "../cells/CellRenderer";
import { ReaktiformPanel } from "../ReaktiformPanel/ReaktiformPanel";
import type {
  GridConfig,
  Row,
  ColumnDef,
  FilterValue,
  CFRule,
  CFCondition,
} from "../../types";

// ── Icons
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Pin,
  PinOff,
  Group,
  Plus,
  Save,
  X,
  Copy,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown as ChevDown,
  RotateCcw,
  RotateCw,
  Palette,
  Columns3,
  Download,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  GripVertical,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  CLIENT-SIDE CSV EXPORT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  CELL VALUE SERIALISER
//  Converts any stored value to a human-readable string for export.
//  Handles: async select { value, label } objects, SelectOption[]
//  arrays (multiselect), plain arrays, primitives.
// ─────────────────────────────────────────────────────────────
function serialiseForExport(val: unknown): string {
  if (val === null || val === undefined) return "";
  // Single async select — { value, label }
  if (
    typeof val === "object" &&
    !Array.isArray(val) &&
    "label" in (val as object)
  ) {
    return String((val as { label: unknown }).label);
  }
  // Array — could be string[] (static multi) or SelectOption[] (async multi)
  if (Array.isArray(val)) {
    return val
      .map((item) =>
        item && typeof item === "object" && "label" in item
          ? String((item as { label: unknown }).label)
          : String(item ?? ""),
      )
      .join(", ");
  }
  return String(val);
}

function exportToCsv(
  cols: ColumnDef[],
  rows: import("@tanstack/react-table").Row<import("../../types").Row>[],
  getVal: (row: import("../../types").Row, key: string) => unknown,
) {
  const headers = cols.map((c) => `"${String(c.label).replace(/"/g, '""')}"`);
  const dataRows = rows
    .filter((r) => !r.getIsGrouped())
    .map((tanRow) => {
      const row = tanRow.original;
      return cols
        .map((col) => {
          const val = getVal(row, col.key as string);
          const str = serialiseForExport(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",");
    });
  const csv = [headers.join(","), ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `export-${today()}.csv`);
}

// ─────────────────────────────────────────────────────────────
//  CLIENT-SIDE EXCEL EXPORT — pure JS, zero external deps.
//  Generates a valid .xlsx using OpenXML SpreadsheetML.
//  For complex formatting/formulas use the onExport server callback.
// ─────────────────────────────────────────────────────────────
function exportToXlsx(
  cols: ColumnDef[],
  rows: import("@tanstack/react-table").Row<import("../../types").Row>[],
  getVal: (row: import("../../types").Row, key: string) => unknown,
) {
  // Flatten to 2D array: header + data
  const header = cols.map((c) => c.label);
  const data = rows
    .filter((r) => !r.getIsGrouped())
    .map((tanRow) => {
      const row = tanRow.original;
      return cols.map((col) => {
        const val = getVal(row, col.key as string);
        return serialiseForExport(val);
      });
    });
  const allRows = [header, ...data];

  // XML escaping
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Build shared strings table for memory efficiency
  const strings: string[] = [];
  const strIdx = new Map<string, number>();
  const si = (s: string) => {
    if (!strIdx.has(s)) {
      strIdx.set(s, strings.length);
      strings.push(s);
    }
    return strIdx.get(s)!;
  };

  // Build worksheet XML
  const rows_xml = allRows
    .map((row, ri) => {
      const cells = row
        .map((cell, ci) => {
          const colLetter = String.fromCharCode(65 + ci);
          const ref = `${colLetter}${ri + 1}`;
          const str = String(cell);
          return `<c r="${ref}" t="s"><v>${si(str)}</v></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rows_xml}</sheetData>
</worksheet>`;

  const stringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}
</sst>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

  // Pack as ZIP (minimal OOXML ZIP without external lib)
  // Uses a self-contained minimal ZIP encoder
  const files: { name: string; data: string }[] = [
    { name: "[Content_Types].xml", data: contentTypesXml },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    { name: "xl/sharedStrings.xml", data: stringsXml },
  ];

  const blob = buildZip(files);
  triggerDownload(blob, `export-${today()}.xlsx`);
}

// ── Minimal ZIP builder — no external dependency
function buildZip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const crc32Table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  const crc32 = (buf: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of buf) c = crc32Table[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32le = (n: number) => [
    n & 0xff,
    (n >> 8) & 0xff,
    (n >> 16) & 0xff,
    (n >> 24) & 0xff,
  ];

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const dataBytes = enc.encode(file.data);
    const crc = crc32(dataBytes);
    const local = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // mod time+date
      ...u32le(crc),
      ...u32le(dataBytes.length),
      ...u32le(dataBytes.length),
      ...u16le(nameBytes.length),
      0x00,
      0x00,
      ...nameBytes,
    ]);
    parts.push(local, dataBytes);
    const dir = new Uint8Array([
      0x50,
      0x4b,
      0x01,
      0x02,
      0x14,
      0x00,
      0x14,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(crc),
      ...u32le(dataBytes.length),
      ...u32le(dataBytes.length),
      ...u16le(nameBytes.length),
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      ...u32le(offset),
      ...nameBytes,
    ]);
    central.push(dir);
    offset += local.length + dataBytes.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([
    0x50,
    0x4b,
    0x05,
    0x06,
    0x00,
    0x00,
    0x00,
    0x00,
    ...u16le(files.length),
    ...u16le(files.length),
    ...u32le(centralSize),
    ...u32le(offset),
    0x00,
    0x00,
  ]);

  const all = [...parts, ...central, eocd];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of all) {
    out.set(a, pos);
    pos += a.length;
  }
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
//  INNER GRID (has access to store context)
// ─────────────────────────────────────────────────────────────
function ReaktiformInner<TData = Record<string, unknown>>(
  props: GridConfig<TData>,
) {
  const grid = useReaktiform<TData>(props);

  // ── Editing cell state
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    colKey: string;
  } | null>(null);

  // ── Filter panel: which column is open + anchor rect for positioning
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);

  // ── Feature 6: show only rows with errors
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // ── Merge base row with draft values — used for readOnly resolution
  // Same logic as CellRenderer's mergedRow but defined here for the td onClick
  function mergeRowWithDraft(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const draft = row["_draft"] as Record<string, unknown> | null | undefined;
    return draft ? { ...row, ...draft } : row;
  }

  // ── Feature 3: error dot popover — which rowId's error popover is open
  const [errorPopoverRowId, setErrorPopoverRowId] = useState<string | null>(
    null,
  );

  // Auto-open the error popover for a row when its save fails.
  // grid.onRowSaveErrorRef is set here so useDraft can call back into this component.
  // Uses the row's internal _id (not the rowIdKey) for reliable lookup.
  useEffect(() => {
    grid.onRowSaveErrorRef.current = (rowInternalId: string) => {
      setErrorPopoverRowId(rowInternalId);
    };
    return () => {
      grid.onRowSaveErrorRef.current = undefined;
    };
  }, [grid.onRowSaveErrorRef]);

  // ── Expanded rows state — tracks which row IDs are expanded inline
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const toggleExpandedRow = (rowId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  };

  // ── Sync / Refresh loading state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Column visibility feature flags (from props.features)
  // selectionMode='none' hides the checkbox column entirely; 'single' shows it
  const selectionMode = props.selectionMode ?? "multi";
  const showSelectColumn =
    selectionMode !== "none" && props.features?.showSelectColumn !== false;
  const showRowNumbers = props.features?.showRowNumbers !== false;
  const showExpanderColumn =
    props.features?.showExpanderColumn !== false &&
    props.features?.sidePanel !== false;
  const showActionsColumn = props.features?.showActionsColumn !== false;

  const openFilter = useCallback(
    (colKey: string, buttonEl: HTMLButtonElement) => {
      if (filterCol === colKey) {
        setFilterCol(null);
        setFilterAnchor(null);
      } else {
        setFilterCol(colKey);
        setFilterAnchor(buttonEl.getBoundingClientRect());
      }
    },
    [filterCol],
  );

  // ── CF panel open
  const [cfPanelOpen, setCfPanelOpen] = useState(false);
  const [cfAnchor, setCfAnchor] = useState<DOMRect | null>(null);
  const [colVisAnchor, setColVisAnchor] = useState<DOMRect | null>(null);

  // ── Column visibility panel open
  const [colVisPanelOpen, setColVisPanelOpen] = useState(false);

  const activateCell = useCallback(
    (rowId: string, colKey: string) => {
      const col = props.columns.find((c) => c.key === colKey);
      if (!col || col.computed) return;
      setEditingCell({ rowId, colKey });
    },
    [props.columns],
  );

  const deactivateCell = useCallback(() => setEditingCell(null), []);

  // visibleRows — memoized to avoid allocating a new array on every scroll render
  const visibleRows = useMemo(
    () => grid.processedRows.map((r) => r.original),
    [grid.processedRows],
  );
  const kb = useKeyboardNav<TData>({
    columns: props.columns,
    visibleRows,
    hiddenColumns: grid.hiddenColumns,
    enabled: props.features?.keyboardNav !== false,
    onActivateCell: activateCell,
    onOpenPanel: grid.openPanel,
  });

  // ── Dirty count
  const dirtyCount = grid.dirtyCount;

  // ── Scroll container ref (required by TanStack Virtual)
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Column drag-reorder state
  const dragColRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // ── Column order (respects user drag-reorder)
  const orderedColumns = useMemo(() => {
    const order = grid.columnOrder;
    if (!order.length) return props.columns;
    const map = new Map(props.columns.map((c) => [c.key as string, c]));
    const sorted = order
      .map((k) => map.get(k))
      .filter(Boolean) as typeof props.columns;
    const inOrder = new Set(order);
    props.columns.forEach((c) => {
      if (!inOrder.has(c.key as string)) sorted.push(c);
    });
    return sorted;
  }, [props.columns, grid.columnOrder]);

  const visibleDataCols = orderedColumns.filter(
    (c) => !grid.hiddenColumns.has(c.key as string),
  );

  const COL_WIDTHS = { cb: 40, rn: 44, exp: 36, act: 88 };

  // Total table width — only count visible system columns
  const totalWidth =
    (showSelectColumn ? COL_WIDTHS.cb : 0) +
    (showRowNumbers ? COL_WIDTHS.rn : 0) +
    (showExpanderColumn ? COL_WIDTHS.exp : 0) +
    visibleDataCols.reduce(
      (sum, c) => sum + (grid.columnWidths[c.key as string] ?? c.width ?? 150),
      0,
    ) +
    (showActionsColumn ? COL_WIDTHS.act : 0);

  // Pin offsets — computed from visible system columns
  const pinOffsets: Record<string, number> = {
    _cb: 0,
    _rn: showSelectColumn ? COL_WIDTHS.cb : 0,
    _exp:
      (showSelectColumn ? COL_WIDTHS.cb : 0) +
      (showRowNumbers ? COL_WIDTHS.rn : 0),
  };
  {
    let left =
      (showSelectColumn ? COL_WIDTHS.cb : 0) +
      (showRowNumbers ? COL_WIDTHS.rn : 0) +
      (showExpanderColumn ? COL_WIDTHS.exp : 0);
    orderedColumns
      .filter(
        (c) =>
          grid.pinnedColumns.has(c.key as string) &&
          !grid.hiddenColumns.has(c.key as string),
      )
      .forEach((c) => {
        pinOffsets[c.key as string] = left;
        left += grid.columnWidths[c.key as string] ?? c.width ?? 150;
      });
  }

  const pinnedList = orderedColumns.filter(
    (c) =>
      grid.pinnedColumns.has(c.key as string) &&
      !grid.hiddenColumns.has(c.key as string),
  );
  const lastPinKey = pinnedList.at(-1)?.key as string | undefined;

  // ── Stable per-column callbacks for ColumnHeaderMemo
  // Inline arrows inside .map() recreate on every render, defeating React.memo.
  // We build Maps keyed by colKey so the identity is stable between renders
  // as long as the underlying grid state hasn't changed for that column.
  const colCallbacks = useMemo(() => {
    const AGG_CYCLE = ["none", "sum", "avg", "min", "max", "count"] as const;
    type AggMode = (typeof AGG_CYCLE)[number];
    const onSort = new Map<string, (e: React.MouseEvent) => void>();
    const onTogglePin = new Map<string, () => void>();
    const onToggleGroup = new Map<string, (isGrouped: boolean) => void>();
    const onOpenFilter = new Map<string, (btn: HTMLButtonElement) => void>();
    const onResize = new Map<string, (w: number) => void>();
    const onCycleAgg = new Map<string, () => void>();

    orderedColumns.forEach((col) => {
      const k = col.key as string;
      // Shift+click = multi-sort (append to sort stack), plain click = single sort
      onSort.set(k, (e: React.MouseEvent) => {
        if (e.shiftKey) {
          grid.setSortMulti(k);
        } else {
          grid.setSort(k);
        }
      });
      onTogglePin.set(k, () => grid.togglePin(k));
      onToggleGroup.set(k, (grouped: boolean) =>
        grid.setGroupBy(grouped ? null : k),
      );
      onOpenFilter.set(k, (btn: HTMLButtonElement) => openFilter(k, btn));
      onResize.set(k, (w: number) => grid.setColumnWidth(k, w));
      if (col.type === "number" && !col.computed) {
        onCycleAgg.set(k, () => {
          const cur = grid.aggregations[k] ?? "none";
          const next =
            AGG_CYCLE[
              (AGG_CYCLE.indexOf(cur as AggMode) + 1) % AGG_CYCLE.length
            ]!;
          grid.setAggregation(k, next);
        });
      }
    });
    return {
      onSort,
      onTogglePin,
      onToggleGroup,
      onOpenFilter,
      onResize,
      onCycleAgg,
    };
    // Rebuild only when column list or aggregation state changes — not on every scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedColumns,
    grid.aggregations,
    grid.setSort,
    grid.setSortMulti,
    grid.togglePin,
    grid.setGroupBy,
    grid.setColumnWidth,
    grid.setAggregation,
    openFilter,
  ]);
  // ── displayRows — respects showErrorsOnly filter.
  // When showErrorsOnly is ON we filter processedRows to only those with
  // validation errors. The virtualizer count updates accordingly.
  const displayRows = useMemo(() => {
    if (!showErrorsOnly) return grid.processedRows;
    return grid.processedRows.filter(
      (r) => Object.keys(r.original._errors ?? {}).length > 0,
    );
  }, [showErrorsOnly, grid.processedRows]);

  const ROW_HEIGHT = props.rowHeight ?? 46;

  // Compute the size of each virtual item accounting for expanded rows.
  // When a row is expanded, its virtual item must include both the data row
  // height AND the expanded content height. The virtualizer calls this per-index
  // so it stays correct as rows expand/collapse without measuring the DOM.
  const EXPANDED_HEIGHT = props.expandedRowHeight ?? 240; // default 240px for expanded content

  const estimateSize = useCallback(
    (index: number): number => {
      if (!props.renderExpandedRow) return ROW_HEIGHT;
      const tanRow = displayRows[index];
      if (!tanRow) return ROW_HEIGHT;
      const rowId = tanRow.original?._id;
      if (rowId && expandedRowIds.has(rowId)) {
        return ROW_HEIGHT + EXPANDED_HEIGHT;
      }
      return ROW_HEIGHT;
      // expandedRowIds is a Set — recreated on toggle, so this dep is correct
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      ROW_HEIGHT,
      EXPANDED_HEIGHT,
      displayRows,
      expandedRowIds,
      props.renderExpandedRow,
    ],
  );

  const virtualizer = useVirtualizer({
    // Use the greater of server totalRows or actual store rows.
    // When "+ New Record" adds an unsaved row, store.length exceeds
    // the server total — without this fix the virtualizer clips the
    // extra row and it visually "disappears" until after a save+refetch.
    count: showErrorsOnly
      ? displayRows.length
      : Math.max(grid.totalRows, displayRows.length),
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
    // measureElement is intentionally omitted — we use estimateSize for predictable
    // layout (no layout shift). If consumers need dynamic heights they can set
    // expandedRowHeight to match their content.
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalTableSize = virtualizer.getTotalSize();

  // ── Infinite scroll fetch trigger
  // Watch the last visible virtual item. When it's within fetchThreshold rows
  // of the end of LOADED data, pre-fetch the next page.
  // This fires BEFORE the user reaches the unloaded rows → zero perceived latency.
  useEffect(() => {
    if (!grid.hasMore) return;
    if (!virtualItems.length) return;

    const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;
    const loadedCount = grid.rows.length;
    const distanceFromEnd = loadedCount - lastVisibleIndex;

    // Pre-fetch when user is fetchThreshold rows from end of loaded data
    if (distanceFromEnd <= grid.fetchThreshold) {
      // Guard: don't double-fetch
      if (grid.isFetchingMoreRef.current) return;
      if (grid.isFetchingMore) return;

      grid.isFetchingMoreRef.current = true;

      const lastRow = grid.rows[loadedCount - 1];
      const cursor = lastRow
        ? String(
            (lastRow as Record<string, unknown>)[props.rowIdKey ?? "id"] ??
              lastRow._id,
          )
        : null;

      const fetchPromise = grid.onFetchMoreRef.current?.({
        cursor,
        offset: loadedCount,
        limit: grid.pageSize,
      });

      // Reset guard when fetch resolves (consumer updates data prop → rows sync)
      if (fetchPromise instanceof Promise) {
        fetchPromise.finally(() => {
          grid.isFetchingMoreRef.current = false;
        });
      } else {
        // Sync callback — reset after microtask so data has time to update
        queueMicrotask(() => {
          grid.isFetchingMoreRef.current = false;
        });
      }
    }
    // virtualItems changes on every scroll — intentional, that's the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems]);

  // ── Dark mode: resolve from prop → CSS class walk → OS preference
  const isDark =
    props.darkMode !== undefined
      ? props.darkMode // explicit prop — highest priority
      : typeof document !== "undefined" &&
        (() => {
          let el: Element | null = document.querySelector("[data-reaktiform]");
          while (el) {
            if (
              el.classList.contains("dark") ||
              el.getAttribute("data-theme") === "dark" ||
              el.getAttribute("data-color-mode") === "dark" ||
              el.getAttribute("data-bs-theme") === "dark"
            )
              return true;
            el = el.parentElement;
          }
          const html = document.documentElement;
          return (
            html.classList.contains("dark") ||
            html.getAttribute("data-theme") === "dark" ||
            document.body?.classList.contains("dark") ||
            (!html.classList.contains("light") &&
              window.matchMedia?.("(prefers-color-scheme: dark)").matches)
          );
        })();

  return (
    <div
      data-reaktiform
      // When darkMode prop or auto-detection says dark, add the .dark class
      // so all [data-reaktiform] CSS var overrides take effect automatically.
      className={cn(
        "rf-flex rf-flex-col w-full",
        isDark && "dark",
        props.className,
      )}
      style={props.style}
    >
      {/* ── TOOLBAR ───────────────────────────────────────── */}
      <div className="bg-rf-surface border border-rf-border border-b-0 rounded-t-rf-lg px-3 py-2 rf-flex rf-items-center rf-gap-2 rf-flex-wrap">
        {/* Search */}
        <div className="rf-relative rf-flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 rf-icon-sm text-rf-text-3 rf-pointer-events-none" />
          <input
            type="text"
            placeholder="Search all fields…"
            value={grid.searchQuery}
            onChange={(e) => grid.setSearch(e.target.value)}
            className={cn(
              "w-full pl-7 pr-2 py-1.5 text-[13px]",
              "border border-rf-border rounded-rf-md bg-rf-bg text-rf-text-1",
              "outline-none focus:border-rf-accent focus:bg-rf-surface",
              "focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
              "placeholder:text-rf-text-3",
            )}
          />
        </div>

        <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />

        {/* Consumer toolbar left slot */}
        {props.toolbarLeft}

        {/* Dirty badge + Save/Discard all */}
        {dirtyCount > 0 && (
          <>
            <span className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12px] rf-font-semibold text-rf-amber bg-rf-amber-bg border border-rf-amber-br rounded-full px-2.5 py-0.5">
              {dirtyCount} unsaved
            </span>
            {grid.permissions.canSave &&
              (() => {
                const isBulkSaving = (grid.savingCount ?? 0) > 0;
                return (
                  <button
                    onClick={() => {
                      if (!isBulkSaving) grid.saveAll();
                    }}
                    disabled={isBulkSaving}
                    className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-ok-bg text-green-700 border border-rf-ok-br hover:bg-green-100 rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                  >
                    {isBulkSaving ? (
                      <>
                        <svg
                          style={{
                            width: 12,
                            height: 12,
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
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save className="rf-icon-sm" /> Save All
                      </>
                    )}
                  </button>
                );
              })()}
            <button
              onClick={() => grid.discardAll()}
              disabled={(grid.savingCount ?? 0) > 0}
              className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-warn-bg text-amber-800 border border-rf-warn-br hover:bg-yellow-100 rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
            >
              <X className="rf-icon-sm" /> Discard All
            </button>
            <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />
          </>
        )}

        {/* Undo/Redo */}
        {props.features?.undoRedo !== false && (
          <>
            <button
              onClick={grid.undo}
              disabled={!grid.canUndo}
              title="Undo (Ctrl+Z)"
              className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <RotateCcw className="rf-icon-sm" />
              Undo
              {grid.historyCount > 0 && (
                <span className="rf-font-mono text-[10.5px] text-rf-text-3 ml-0.5">
                  {grid.historyCount}
                </span>
              )}
            </button>
            <button
              onClick={grid.redo}
              disabled={!grid.canRedo}
              title="Redo (Ctrl+Y)"
              className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header hover:text-rf-text-1 disabled:opacity-35 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              Redo
              <RotateCw className="rf-icon-sm" />
            </button>
            <div className="w-px h-[18px] bg-rf-border rf-flex-shrink-0" />
          </>
        )}

        <div className="rf-ml-auto rf-flex rf-items-center rf-gap-2">
          {/* Feature 6 — Show errors only toggle */}
          {(() => {
            const errorCount = grid.rows.filter(
              (r) => Object.keys(r._errors ?? {}).length > 0,
            ).length;
            if (errorCount === 0) return null;
            return (
              <button
                onClick={() => setShowErrorsOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                  showErrorsOnly
                    ? "bg-rf-err-bg text-rf-err border-rf-err-br"
                    : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br",
                )}
                title={
                  showErrorsOnly
                    ? "Show all rows"
                    : `Show only rows with errors (${errorCount})`
                }
              >
                <AlertTriangle className="rf-icon-sm" />
                {errorCount} {errorCount === 1 ? "error" : "errors"}
                {showErrorsOnly && <X className="rf-icon-xs ml-0.5" />}
              </button>
            );
          })()}
          <span className="text-[12px] text-rf-text-3">
            {grid.processedRows.length} / {visibleRows.length} rows
          </span>
          {/* Conditional Format button */}
          {props.features?.conditionalFormat !== false && (
            <button
              onClick={(e) => {
                setCfAnchor(
                  (
                    e.currentTarget as HTMLButtonElement
                  ).getBoundingClientRect(),
                );
                setCfPanelOpen((v) => !v);
              }}
              className={cn(
                "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                grid.cfRules.some((r) => r.enabled)
                  ? "bg-rf-purple-bg text-purple-700 border-rf-purple-br"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
              )}
              title="Conditional formatting"
            >
              <Palette className="rf-icon-sm" />
            </button>
          )}
          {/* Column visibility button */}
          {props.features?.columnHide !== false && (
            <button
              onClick={(e) => {
                setColVisAnchor(
                  (
                    e.currentTarget as HTMLButtonElement
                  ).getBoundingClientRect(),
                );
                setColVisPanelOpen((v) => !v);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                grid.hiddenColumns.size > 0
                  ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
              )}
              title="Show/hide columns"
            >
              <Columns3 className="rf-icon-sm" />
              {grid.hiddenColumns.size > 0 && (
                <span className="text-[10px] rf-font-bold">
                  {props.columns.length - grid.hiddenColumns.size}/
                  {props.columns.length}
                </span>
              )}
            </button>
          )}
          {/* Sync / Refresh button */}
          {props.onRefresh && (
            <button
              onClick={async () => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                try {
                  await props.onRefresh!();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
              className={cn(
                "inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-rf-md border transition-colors",
                isRefreshing
                  ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br cursor-not-allowed"
                  : "bg-rf-surface text-rf-text-2 border-rf-border hover:bg-rf-header",
              )}
              title="Sync / Refresh data"
            >
              <RefreshCw
                className="rf-icon-sm"
                style={
                  isRefreshing
                    ? { animation: "spin 0.8s linear infinite" }
                    : undefined
                }
              />
              {isRefreshing ? "Syncing…" : "Sync"}
            </button>
          )}
          {/* Export — CSV + Excel, client-side or server-side */}
          {grid.permissions.canExport && props.features?.export !== false && (
            <>
              <button
                onClick={async () => {
                  if (props.onExport) {
                    await props.onExport("csv");
                  } else {
                    exportToCsv(
                      visibleDataCols as ColumnDef[],
                      grid.processedRows,
                      grid.getVal as (
                        row: import("../../types").Row,
                        key: string,
                      ) => unknown,
                    );
                  }
                }}
                className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header rf-transition-colors"
                title={
                  props.onExport
                    ? "Export all records to CSV (server)"
                    : "Export visible rows to CSV"
                }
              >
                <Download className="rf-icon-sm" /> CSV
              </button>
              <button
                onClick={async () => {
                  if (props.onExport) {
                    await props.onExport("xlsx");
                  } else {
                    exportToXlsx(
                      visibleDataCols as ColumnDef[],
                      grid.processedRows,
                      grid.getVal as (
                        row: import("../../types").Row,
                        key: string,
                      ) => unknown,
                    );
                  }
                }}
                className="rf-inline-flex rf-items-center rf-gap-1 text-[12px] rf-font-medium px-2.5 py-1.5 rounded-rf-md border border-rf-border bg-rf-surface text-rf-text-2 hover:bg-rf-header rf-transition-colors"
                title={
                  props.onExport
                    ? "Export all records to Excel (server)"
                    : "Export visible rows to Excel"
                }
              >
                <FileSpreadsheet className="rf-icon-sm" /> Excel
              </button>
            </>
          )}
          {/* Consumer toolbar right slot */}
          {props.toolbarRight}

          {/* New Record */}
          {grid.permissions.canCreate && (
            <button
              onClick={() => grid.addRow()}
              className="rf-inline-flex rf-items-center rf-gap-1.5 text-[12.5px] rf-font-medium px-3 py-1.5 rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover rf-transition-colors"
            >
              <Plus className="rf-icon-sm" /> New Record
            </button>
          )}
        </div>
      </div>

      {/* ── ACTIVE FILTERS BAR ────────────────────────────── */}
      {Object.keys(grid.activeFilters).length > 0 && (
        <div className="rf-flex rf-items-center rf-gap-2 rf-flex-wrap px-3 py-2 bg-rf-accent-bg border border-rf-accent-br border-b-0 text-[12px]">
          <span className="rf-font-semibold text-rf-accent">
            Active filters:
          </span>
          {Object.entries(grid.activeFilters).map(([key]) => {
            const col = props.columns.find((c) => c.key === key);
            return (
              <span
                key={key}
                className="rf-inline-flex rf-items-center rf-gap-1 bg-rf-surface border border-rf-accent-br rounded-full px-2.5 py-0.5 text-rf-accent rf-font-medium"
              >
                {col?.label ?? key}
                <button
                  onClick={() => grid.clearFilter(key)}
                  className="rf-opacity-60 hover:opacity-100"
                >
                  <X className="rf-icon-xs" />
                </button>
              </span>
            );
          })}
          <button
            onClick={grid.clearAllFilters}
            className="rf-ml-auto text-rf-accent rf-font-medium opacity-70 hover:opacity-100"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── BULK ACTIONS BAR ──────────────────────────────── */}
      {grid.selectedIds.size > 0 && (
        <div className="rf-flex rf-items-center rf-gap-3 px-4 py-2 bg-rf-accent text-white border border-rf-accent border-b-0 rounded-t-rf-lg text-[12.5px] rf-font-medium rf-flex-shrink-0">
          <span className="rf-font-semibold">
            {grid.selectedIds.size} row{grid.selectedIds.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="w-px rf-icon-lg bg-white/20" />
          {/* Bulk delete — uses onBulkDelete (single API call) when provided,
               falls back to sequential onDelete calls */}
          {(props.onBulkDelete || props.onDelete) &&
            [...grid.selectedIds].every((id) => {
              const r = grid.rows.find((row) => row._id === id);
              return (
                r && grid.permissions.canDeleteRow(r as Record<string, unknown>)
              );
            }) && (
              <button
                onClick={async () => {
                  const ids = [...grid.selectedIds];
                  if (props.onBulkDelete) {
                    // Preferred: single API call for all selected rows
                    try {
                      await props.onBulkDelete(ids);
                      // Remove all deleted rows from store at once
                      ids.forEach((id) => {
                        const row = grid.rows.find((r) => r._id === id);
                        if (row) grid.deleteRow(row._id);
                      });
                    } catch (err) {
                      console.error("[reaktiform] bulk delete failed:", err);
                    }
                  } else {
                    // Fallback: sequential — each fires onDelete separately
                    for (const id of ids) {
                      await grid.deleteRow(id);
                    }
                  }
                  grid.clearSelection();
                }}
                className="rf-inline-flex rf-items-center rf-gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
              >
                <Trash2 className="rf-icon-sm" /> Delete{" "}
                {grid.selectedIds.size > 1
                  ? `${grid.selectedIds.size} rows`
                  : "selected"}
              </button>
            )}
          {/* Bulk save (only dirty rows) — gated by canSave */}
          {grid.permissions.canSave &&
            [...grid.selectedIds].some((id) => {
              const row = grid.rows.find((r) => r._id === id);
              return row && grid.isDirty(row);
            }) && (
              <button
                onClick={() => void grid.saveAll()}
                className="rf-inline-flex rf-items-center rf-gap-1.5 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
              >
                <Save className="rf-icon-sm" /> Save selected
              </button>
            )}
          <div className="rf-ml-auto" />
          <button
            onClick={grid.clearSelection}
            className="rf-inline-flex rf-items-center rf-gap-1 px-2.5 py-1 rounded-rf-md bg-white/10 hover:bg-white/20 rf-transition-colors"
          >
            <X className="rf-icon-sm" /> Deselect all
          </button>
        </div>
      )}

      {/* ── GRID ──────────────────────────────────────────── */}
      <div
        className="bg-rf-surface border border-rf-border border-t-0 rounded-b-rf-lg shadow-rf-sm"
        style={{ overflow: "clip" }}
      >
        {/* isFetching — subtle top progress bar (doesn't block interaction) */}
        {grid.isFetching && (
          <div className="h-[3px] bg-rf-accent-bg rf-overflow-hidden">
            <div
              className="rf-h-full bg-rf-accent rounded-full"
              style={{
                animation: "rfFetch 1.4s ease-in-out infinite",
                width: "40%",
              }}
            />
          </div>
        )}

        {/* Single scroll container — overflow in both directions
            thead sticky top-0 works because this div has a fixed maxHeight
            and overflow-y:auto — sticky is relative to this scroll parent  */}
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto"
          style={{
            maxHeight: props.maxHeight ?? "calc(100vh - 300px)",
            minHeight: props.minHeight ?? 380,
            // NOTE: we cannot use contain:strict here because it creates a
            // new stacking context that traps position:fixed children (error
            // popover, react-select dropdowns) below the sticky thead.
            // contain: 'strict',  ← removed
            position: "relative", // establishes stacking context for sticky thead only
          }}
          onClick={() => {
            if (editingCell) deactivateCell();
          }}
        >
          <table
            className="border-separate border-spacing-0"
            style={{
              // min-width: the larger of totalWidth or 100% of the container.
              // width: 100% ensures the table fills the full container when
              // columns are few. min-width: totalWidth triggers horizontal scroll
              // when columns are many.
              width: "100%",
              minWidth: totalWidth,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {showSelectColumn && <col style={{ width: COL_WIDTHS.cb }} />}
              {showRowNumbers && <col style={{ width: COL_WIDTHS.rn }} />}
              {showExpanderColumn && <col style={{ width: COL_WIDTHS.exp }} />}
              {visibleDataCols.map((col) => (
                <col
                  key={col.key as string}
                  style={{
                    width:
                      grid.columnWidths[col.key as string] ?? col.width ?? 150,
                  }}
                />
              ))}
              {showActionsColumn && <col />}
            </colgroup>

            {/* ── THEAD ─────────────────────────────────── */}
            <thead className="sticky top-0 z-50">
              <tr>
                {/* Checkbox — optional */}
                {showSelectColumn && (
                  <th
                    className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] w-10 text-center sticky z-[45]"
                    style={{ left: pinOffsets["_cb"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center rf-h-full">
                      <input
                        type="checkbox"
                        className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] rf-cursor-pointer"
                        // Only select rows that pass isRowSelectable
                        onChange={() => {
                          const selectableIds = visibleRows
                            .filter(
                              (r) =>
                                !props.isRowSelectable ||
                                props.isRowSelectable(r as unknown as TData),
                            )
                            .map((r) => r._id);
                          grid.toggleSelectAll(selectableIds);
                          if (props.onSelectionChange) {
                            const allSelected = selectableIds.every((id) =>
                              grid.selectedIds.has(id),
                            );
                            const newIds = allSelected ? [] : selectableIds;
                            const newRows = newIds
                              .map((id) => grid.rows.find((r) => r._id === id))
                              .filter(Boolean) as Row<TData>[];
                            requestAnimationFrame(() =>
                              props.onSelectionChange!(
                                newIds,
                                newRows as unknown as TData[],
                              ),
                            );
                          }
                        }}
                        // Hidden in single-select mode
                        style={
                          selectionMode === "single"
                            ? { display: "none" }
                            : undefined
                        }
                      />
                    </div>
                  </th>
                )}

                {/* Row # — optional */}
                {showRowNumbers && (
                  <th
                    className="bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]"
                    style={{ left: pinOffsets["_rn"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px] px-2">
                      <span className="text-[10.5px] rf-font-semibold text-rf-text-3 rf-uppercase tracking-wider">
                        #
                      </span>
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}

                {/* Expander — optional (auto-hidden if sidePanel is off) */}
                {showExpanderColumn && (
                  <th
                    className={cn(
                      "bg-rf-header border-b-2 border-r border-rf-border h-[64px] sticky z-[45]",
                      !lastPinKey && "shadow-[4px_0_10px_rgba(15,23,42,.08)]",
                    )}
                    style={{ left: pinOffsets["_exp"] }}
                  >
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px]">
                      <ChevronRight className="rf-icon-sm text-rf-text-3" />
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}

                {/* Data columns — in user-defined order */}
                {visibleDataCols.map((col) => {
                  const colKey = col.key as string;
                  const isPinned = grid.pinnedColumns.has(colKey);
                  const isLastPin = lastPinKey === colKey;
                  const isSorted =
                    grid.sortModel.some((s) => s?.colKey === colKey) ||
                    grid.sortState?.colKey === colKey;
                  const sortEntry = grid.sortModel.find(
                    (s) => s?.colKey === colKey,
                  );
                  const sortPriority =
                    grid.sortModel.length > 1
                      ? grid.sortModel.findIndex((s) => s?.colKey === colKey) +
                        1
                      : undefined;
                  const isFiltered = !!grid.activeFilters[colKey];
                  const isGrouped = grid.groupByCol === colKey;

                  return (
                    <ColumnHeaderMemo
                      key={colKey}
                      col={col as ColumnDef}
                      isPinned={isPinned}
                      isLastPin={isLastPin}
                      isSorted={isSorted}
                      sortDir={
                        sortEntry?.direction ?? grid.sortState?.direction
                      }
                      isFiltered={isFiltered}
                      isGrouped={isGrouped}
                      isDragOver={dragOver === colKey}
                      {...(sortPriority !== undefined && { sortPriority })}
                      {...(grid.aggregations[colKey] !== undefined && {
                        aggregationMode: grid.aggregations[colKey],
                      })}
                      pinOffset={isPinned ? pinOffsets[colKey] : undefined}
                      onSort={colCallbacks.onSort.get(colKey)!}
                      onTogglePin={colCallbacks.onTogglePin.get(colKey)!}
                      onToggleGroup={() =>
                        colCallbacks.onToggleGroup.get(colKey)!(isGrouped)
                      }
                      onOpenFilter={colCallbacks.onOpenFilter.get(colKey)!}
                      onResize={colCallbacks.onResize.get(colKey)!}
                      onDragStart={() => {
                        dragColRef.current = colKey;
                      }}
                      onDragOver={() => setDragOver(colKey)}
                      onDragEnd={() => {
                        const from = dragColRef.current;
                        const to = dragOver;
                        if (from && to && from !== to) {
                          const cur = orderedColumns.map(
                            (c) => c.key as string,
                          );
                          const fromIdx = cur.indexOf(from);
                          const toIdx = cur.indexOf(to);
                          if (fromIdx !== -1 && toIdx !== -1) {
                            const next = [...cur];
                            next.splice(fromIdx, 1);
                            next.splice(toIdx, 0, from);
                            grid.setColumnOrder(next);
                          }
                        }
                        dragColRef.current = null;
                        setDragOver(null);
                      }}
                      onCycleAggregation={colCallbacks.onCycleAgg.get(colKey)}
                    />
                  );
                })}

                {/* Actions — no width, fills remaining space — optional */}
                {showActionsColumn && (
                  <th className="bg-rf-header border-b-2 border-rf-border h-[64px]">
                    <div className="rf-flex rf-items-center rf-justify-center h-[36px] px-2">
                      <span className="text-[10.5px] rf-font-semibold text-rf-text-3 rf-uppercase tracking-wider">
                        Actions
                      </span>
                    </div>
                    <div className="h-[28px] border-t border-rf-border bg-black/[.015]" />
                  </th>
                )}
              </tr>
            </thead>

            {/* ── TBODY — TanStack Virtual padding-rows pattern ── */}
            {/*
              Correct approach for virtualizing a native <table>:
              - Keep display:table on <tbody> — native table layout works
              - Render a top-padding <tr> and bottom-padding <tr>
              - Only render virtualItems between them
              - <td> gets explicit width from col.width / grid.columnWidths
              - sticky works correctly because <td> is a table cell, not flex child
            */}
            <tbody>
              {/* isLoading skeleton */}
              {grid.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={`skel-${i}`}
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: "1px solid var(--rf-border)",
                    }}
                  >
                    {showSelectColumn && (
                      <td
                        style={{
                          width: COL_WIDTHS.cb,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
                    {showRowNumbers && (
                      <td
                        style={{
                          width: COL_WIDTHS.rn,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
                    {showExpanderColumn && (
                      <td
                        style={{
                          width: COL_WIDTHS.exp,
                          borderRight: "1px solid var(--rf-border)",
                        }}
                      />
                    )}
                    {visibleDataCols.map((col) => (
                      <td
                        key={col.key as string}
                        style={{
                          width:
                            grid.columnWidths[col.key as string] ??
                            col.width ??
                            150,
                          borderRight: "1px solid var(--rf-border)",
                          padding: "0 12px",
                        }}
                      >
                        <div
                          style={{
                            height: 14,
                            borderRadius: 4,
                            background: "var(--rf-border)",
                            width: `${55 + ((i * 13 + (col.key as string).length * 7) % 35)}%`,
                            animation: "rfPulse 1.5s ease-in-out infinite",
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      </td>
                    ))}
                    {showActionsColumn && <td style={{}} />}
                  </tr>
                ))}

              {/* Top padding row — fills space above first virtual item */}
              {!grid.isLoading && virtualItems.length > 0 && (
                <tr style={{ height: virtualItems[0]?.start ?? 0 }}>
                  <td
                    colSpan={
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0)
                    }
                    style={{ padding: 0, border: "none" }}
                  />
                </tr>
              )}

              {/* Visible virtual rows — handles group headers, data rows, and unloaded skeletons */}
              {!grid.isLoading &&
                virtualItems.map((virtualRow) => {
                  // ── SKELETON ROW — index is beyond loaded data (infinite scroll)
                  // These rows exist in the virtual space but haven't been fetched yet.
                  // Show shimmer so the user sees content is coming, not blank space.
                  if (virtualRow.index >= grid.processedRows.length) {
                    return (
                      <tr
                        key={`unloaded-${virtualRow.index}`}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: "1px solid var(--rf-border)",
                        }}
                      >
                        <td
                          style={{
                            width: COL_WIDTHS.cb,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        <td
                          style={{
                            width: COL_WIDTHS.rn,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 10,
                              borderRadius: 3,
                              background: "var(--rf-border)",
                              margin: "0 auto",
                              animation: "rfPulse 1.5s ease-in-out infinite",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            width: COL_WIDTHS.exp,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        {visibleDataCols.map((col, ci) => (
                          <td
                            key={col.key as string}
                            style={{
                              width:
                                grid.columnWidths[col.key as string] ??
                                col.width ??
                                150,
                              borderRight: "1px solid var(--rf-border)",
                              padding: "0 12px",
                              verticalAlign: "middle",
                            }}
                          >
                            <div
                              style={{
                                height: 12,
                                borderRadius: 3,
                                background: "var(--rf-border)",
                                // Vary skeleton widths per column for realistic look
                                width: `${45 + ((virtualRow.index * 7 + ci * 13) % 40)}%`,
                                animation: "rfPulse 1.5s ease-in-out infinite",
                                // Stagger animation so rows pulse sequentially
                                animationDelay: `${(virtualRow.index % 5) * 0.1}s`,
                              }}
                            />
                          </td>
                        ))}
                        <td style={{}} />
                      </tr>
                    );
                  }

                  const tanRow = displayRows[virtualRow.index];
                  if (!tanRow) return null;

                  // ── GROUP HEADER ROW
                  if (tanRow.getIsGrouped()) {
                    const groupVal = tanRow.getGroupingValue(
                      tanRow.groupingColumnId ?? "",
                    );
                    const isExpanded = tanRow.getIsExpanded();
                    const groupColDef = props.columns.find(
                      (c) => c.key === tanRow.groupingColumnId,
                    );
                    const opt = groupColDef?.options?.find(
                      (o) => o.value === String(groupVal ?? ""),
                    );
                    return (
                      <tr
                        key={tanRow.id}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: "1px solid var(--rf-border)",
                          background: "var(--rf-header)",
                          cursor: "pointer",
                        }}
                        onClick={() => tanRow.toggleExpanded()}
                      >
                        <td
                          style={{
                            width: COL_WIDTHS.cb,
                            borderRight: "1px solid var(--rf-border)",
                          }}
                        />
                        <td
                          style={{
                            width: COL_WIDTHS.rn,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--rf-text-3)",
                            fontFamily: "var(--rf-font-mono)",
                          }}
                        >
                          {tanRow.subRows.length}
                        </td>
                        <td
                          style={{
                            width: COL_WIDTHS.exp,
                            borderRight: "1px solid var(--rf-border)",
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          <ChevDown
                            style={{
                              width: 13,
                              height: 13,
                              color: "var(--rf-text-3)",
                              transform: isExpanded
                                ? "rotate(0deg)"
                                : "rotate(-90deg)",
                              transition: "transform .15s",
                            }}
                          />
                        </td>
                        <td
                          colSpan={visibleDataCols.length + 1}
                          style={{ padding: "0 12px", verticalAlign: "middle" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".04em",
                                color: "var(--rf-text-3)",
                              }}
                            >
                              {groupColDef?.label ?? tanRow.groupingColumnId}:
                            </span>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: "var(--rf-text-1)",
                              }}
                            >
                              {opt?.label ?? String(groupVal ?? "—")}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--rf-text-3)",
                                marginLeft: 4,
                              }}
                            >
                              ({tanRow.subRows.length}{" "}
                              {tanRow.subRows.length === 1
                                ? "record"
                                : "records"}
                              )
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // ── DATA ROW
                  const row = tanRow.original;
                  const rowId = row._id;
                  const isDirty = grid.isDirty(row);
                  const hasErrors = Object.keys(row._errors ?? {}).length > 0;
                  const cfResult = grid.evalCF(row);
                  const isKbFocused = kb.kbFocusRowId === rowId;
                  const isSelected = grid.selectedIds.has(rowId);
                  const isPanelOpen = grid.panelRowId === rowId;

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
                  const isDisabled =
                    props.isRowDisabled?.(consumerRowData) ?? false;
                  const extraClass = props.rowClassName?.(consumerRowData);
                  const extraStyle = props.rowStyle?.(consumerRowData);

                  const dataRow = (
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
                        (e.currentTarget as HTMLElement).style.background =
                          base;
                      }}
                      onClick={(e) => {
                        if (isDisabled) return;
                        kb.setFocus(rowId, kb.kbFocusColIdx ?? 0);
                        // Fire consumer row click if the click wasn't on a cell/button
                        const target = e.target as HTMLElement;
                        if (
                          target.tagName !== "BUTTON" &&
                          target.tagName !== "INPUT"
                        ) {
                          props.onRowClick?.(consumerRowData);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isDisabled) return;
                        props.onRowDoubleClick?.(consumerRowData);
                      }}
                    >
                      {/* Checkbox — optional */}
                      {showSelectColumn && (
                        <td
                          style={{
                            width: COL_WIDTHS.cb,
                            padding: 0,
                            borderRight: "1px solid var(--rf-border)",
                            background: isDirty
                              ? "var(--rf-row-dirty)"
                              : "var(--rf-surface)",
                            position: "sticky",
                            left: pinOffsets["_cb"] ?? 0,
                            zIndex: 20,
                            textAlign: "center",
                            verticalAlign: "middle",
                          }}
                        >
                          <input
                            type={
                              selectionMode === "single" ? "radio" : "checkbox"
                            }
                            checked={isSelected}
                            // isRowSelectable guard — if false, checkbox is disabled entirely
                            disabled={
                              props.isRowSelectable
                                ? !props.isRowSelectable(consumerRowData)
                                : false
                            }
                            onChange={() => {
                              if (
                                props.isRowSelectable &&
                                !props.isRowSelectable(consumerRowData)
                              )
                                return;
                              if (selectionMode === "single") {
                                // Deselect all others first, then select this one
                                grid.clearSelection();
                                if (!isSelected) grid.toggleSelect(rowId);
                              } else {
                                grid.toggleSelect(rowId);
                              }
                              // Fire onSelectionChange after store updates
                              if (props.onSelectionChange) {
                                const newIds =
                                  selectionMode === "single"
                                    ? isSelected
                                      ? []
                                      : [rowId]
                                    : isSelected
                                      ? [...grid.selectedIds].filter(
                                          (id) => id !== rowId,
                                        )
                                      : [...grid.selectedIds, rowId];
                                const newRows = newIds
                                  .map((id) =>
                                    grid.rows.find((r) => r._id === id),
                                  )
                                  .filter(Boolean) as Row<TData>[];
                                requestAnimationFrame(() =>
                                  props.onSelectionChange!(
                                    newIds,
                                    newRows as unknown as TData[],
                                  ),
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
                                  setErrorPopoverRowId((prev) =>
                                    prev === rowId ? null : rowId,
                                  );
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
                                title={
                                  isDirty
                                    ? "Unsaved"
                                    : row._new
                                      ? "New"
                                      : "Saved"
                                }
                              />
                            )}
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--rf-text-3)",
                                fontFamily: "var(--rf-font-mono)",
                              }}
                            >
                              {virtualRow.index + 1}
                            </span>

                            {/* Error popover — shows validation errors AND API save errors */}
                            {errorPopoverRowId === rowId &&
                              (hasErrors || row._saveError) && (
                                <ErrorPopover
                                  rowId={rowId}
                                  errors={row._errors ?? {}}
                                  saveError={row._saveError}
                                  columns={props.columns as ColumnDef[]}
                                  onClose={() => setErrorPopoverRowId(null)}
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
                          {props.renderExpandedRow ? (
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
                              title={
                                expandedRowIds.has(rowId)
                                  ? "Collapse row"
                                  : "Expand row"
                              }
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
                                isPanelOpen
                                  ? grid.closePanel()
                                  : grid.openPanel(rowId);
                              }}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                border: `1px solid ${isPanelOpen ? "var(--rf-accent)" : "var(--rf-border)"}`,
                                background: isPanelOpen
                                  ? "var(--rf-accent)"
                                  : "transparent",
                                color: isPanelOpen
                                  ? "#fff"
                                  : "var(--rf-text-3)",
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
                        const colWidth =
                          grid.columnWidths[colKey] ?? col.width ?? 150;
                        const isPinned = grid.pinnedColumns.has(colKey);
                        const isLastPinCol = lastPinKey === colKey;
                        const isEditing =
                          editingCell?.rowId === rowId &&
                          editingCell?.colKey === colKey;
                        // Resolve readOnly — supports boolean or (row) => boolean
                        const rowData_ = mergeRowWithDraft(
                          row as Record<string, unknown>,
                        );
                        const isReadOnly =
                          col.readOnly === true ||
                          (typeof col.readOnly === "function" &&
                            col.readOnly(rowData_ as TData));
                        const isKbCell =
                          isKbFocused && kb.kbFocusColIdx === cIdx;
                        const cellVal = grid.getVal(row, colKey);
                        const computedVal = col.computed
                          ? grid.getComputedValue(row, colKey)
                          : undefined;
                        const errMsg = row._errors?.[colKey];
                        const hasErr = !!errMsg;

                        // Compute the cell's background — must be explicit (not undefined/transparent)
                        // for ALL cells so non-pinned cells act as opaque barriers when
                        // scrolling horizontally past sticky pinned columns.
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
                              // Non-pinned editing/focused cells use lower z-index
                              // so they never visually overlap the sticky column.
                              zIndex: isPinned
                                ? 20
                                : isEditing
                                  ? 18
                                  : isKbCell
                                    ? 15
                                    : undefined,
                              // Every cell has an explicit opaque background.
                              // Without this, transparent cells bleed text over sticky pinned cols.
                              background: cellBg,
                              outline: isEditing
                                ? "2px solid var(--rf-accent)"
                                : isKbCell && !isEditing
                                  ? "2px solid var(--rf-accent-br)"
                                  : undefined,
                              outlineOffset:
                                isEditing || isKbCell ? "-2px" : undefined,
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
                              cursor: isReadOnly
                                ? "default"
                                : grid.permissions.canEditRow(
                                      row as Record<string, unknown>,
                                    ) &&
                                    grid.permissions.canEditCol(colKey) &&
                                    col.type !== "checkbox" &&
                                    (!col.computed || col.editableWhenComputed)
                                  ? "text"
                                  : "default",
                            }}
                            onClick={() => {
                              const rowData = row as Record<string, unknown>;
                              const canEdit =
                                grid.permissions.canEditRow(rowData) &&
                                grid.permissions.canEditCol(colKey) &&
                                !isReadOnly;
                              const isEditableComputed =
                                col.computed && col.editableWhenComputed;
                              if (
                                canEdit &&
                                col.type !== "checkbox" &&
                                (!col.computed || isEditableComputed)
                              ) {
                                activateCell(rowId, colKey);
                              }
                              kb.setFocus(rowId, cIdx);
                            }}
                          >
                            <CellRenderer
                              row={row}
                              colDef={col as ColumnDef}
                              value={
                                // For editableWhenComputed: when editing use the draft/committed value
                                // so the user sees what they typed. When reading, use the formula result.
                                col.computed && col.editableWhenComputed
                                  ? isEditing
                                    ? cellVal
                                    : (computedVal ?? cellVal)
                                  : col.computed
                                    ? computedVal
                                    : cellVal
                              }
                              isEditing={isEditing}
                              isError={hasErr}
                              onCommit={(val) => {
                                grid.markDirty(rowId, colKey, val);
                                deactivateCell();
                              }}
                              onCancel={deactivateCell}
                              {...(computedVal !== undefined && {
                                computedValue: computedVal,
                              })}
                              {...(errMsg !== undefined && {
                                errorMessage: errMsg,
                              })}
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
                                {/* Save error — shown as pulsing dot in the row number column.
                                Click the dot to see the full API error message in the popover. */}
                                {grid.permissions.canSave && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!row._saving)
                                        void grid.saveRow(rowId);
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
                                      cursor: row._saving
                                        ? "not-allowed"
                                        : "pointer",
                                      opacity: row._saving ? 0.65 : 1,
                                      fontFamily: "inherit",
                                    }}
                                    title={
                                      row._saving ? "Saving…" : "Save changes"
                                    }
                                  >
                                    {row._saving ? (
                                      <>
                                        <svg
                                          style={{
                                            width: 11,
                                            height: 11,
                                            animation:
                                              "rf-spin 0.8s linear infinite",
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
                                        <Save
                                          style={{ width: 11, height: 11 }}
                                        />{" "}
                                        Save
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    grid.discardRow(rowId);
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
                                {grid.permissions.canDuplicateRow(
                                  row as Record<string, unknown>,
                                ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      grid.duplicateRow(rowId);
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
                                {grid.permissions.canDeleteRow(
                                  row as Record<string, unknown>,
                                ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void grid.deleteRow(rowId);
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

                  // ── EXPANDED ROW — rendered immediately below parent using Fragment
                  if (props.renderExpandedRow && expandedRowIds.has(rowId)) {
                    const totalCols =
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0);
                    return (
                      <React.Fragment key={`frag-${rowId}`}>
                        {dataRow}
                        <tr
                          style={{
                            background: "var(--rf-accent-bg)",
                            borderBottom: "2px solid var(--rf-accent-br)",
                          }}
                        >
                          <td
                            colSpan={totalCols}
                            style={{
                              padding: 0,
                              borderTop: "1px solid var(--rf-accent-br)",
                            }}
                          >
                            <div
                              style={{
                                padding: "12px 16px",
                                height: props.expandedRowHeight,
                                overflow: props.expandedRowHeight
                                  ? "auto"
                                  : undefined,
                              }}
                            >
                              {props.renderExpandedRow(row as unknown as TData)}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  return dataRow;
                })}

              {/* Bottom padding row — fills space below last virtual item */}
              {!grid.isLoading &&
                virtualItems.length > 0 &&
                (() => {
                  const lastItem = virtualItems[virtualItems.length - 1];
                  const bottomPad = lastItem
                    ? totalTableSize - lastItem.end
                    : 0;
                  return bottomPad > 0 ? (
                    <tr style={{ height: bottomPad }}>
                      <td
                        colSpan={
                          visibleDataCols.length +
                          (showSelectColumn ? 1 : 0) +
                          (showRowNumbers ? 1 : 0) +
                          (showExpanderColumn ? 1 : 0) +
                          (showActionsColumn ? 1 : 0)
                        }
                        style={{ padding: 0, border: "none" }}
                      />
                    </tr>
                  ) : null;
                })()}

              {/* Empty state — shown when not loading and no rows */}
              {!grid.isLoading && displayRows.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0)
                    }
                    style={{ padding: 0 }}
                  >
                    {props.emptyState ? (
                      <div style={{ padding: "32px 24px" }}>
                        {props.emptyState}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "40px 24px",
                          gap: 12,
                          color: "var(--rf-text-3)",
                        }}
                      >
                        <svg
                          width="40"
                          height="40"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ opacity: 0.4 }}
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          No records found
                        </span>
                        {Object.keys(grid.activeFilters).length > 0 && (
                          <button
                            onClick={grid.clearAllFilters}
                            style={{
                              fontSize: 12.5,
                              color: "var(--rf-accent)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            Clear filters to show all records
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {/* Add record button */}
              {!grid.isLoading && grid.permissions.canCreate && (
                <tr>
                  <td
                    colSpan={
                      visibleDataCols.length +
                      (showSelectColumn ? 1 : 0) +
                      (showRowNumbers ? 1 : 0) +
                      (showExpanderColumn ? 1 : 0) +
                      (showActionsColumn ? 1 : 0)
                    }
                    style={{
                      padding: 0,
                      borderTop: "1px solid var(--rf-border)",
                    }}
                  >
                    <button
                      onClick={() => grid.addRow()}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 16px",
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--rf-text-3)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.color = "var(--rf-accent)";
                        b.style.background = "var(--rf-row-hover)";
                      }}
                      onMouseLeave={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.color = "var(--rf-text-3)";
                        b.style.background = "transparent";
                      }}
                    >
                      <Plus style={{ width: 15, height: 15 }} /> Add record
                    </button>
                  </td>
                </tr>
              )}
            </tbody>

            {/* ── TFOOT — Aggregation row ────────────────── */}
            {visibleDataCols.some(
              (c) =>
                grid.aggregations[c.key as string] &&
                grid.aggregations[c.key as string] !== "none",
            ) && (
              <tfoot className="sticky bottom-0 z-40">
                <tr
                  style={{
                    background: "var(--rf-header)",
                    borderTop: "2px solid var(--rf-border)",
                  }}
                >
                  <td
                    style={{
                      width: COL_WIDTHS.cb,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  <td
                    style={{
                      width: COL_WIDTHS.rn,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  <td
                    style={{
                      width: COL_WIDTHS.exp,
                      borderRight: "1px solid var(--rf-border)",
                    }}
                  />
                  {visibleDataCols.map((col) => {
                    const colKey = col.key as string;
                    const mode = grid.aggregations[colKey] ?? "none";
                    const result =
                      mode !== "none"
                        ? grid.computeAggregation(colKey, mode)
                        : null;
                    return (
                      <td
                        key={colKey}
                        style={{
                          width: grid.columnWidths[colKey] ?? col.width ?? 150,
                          borderRight: "1px solid var(--rf-border)",
                          padding: "4px 10px",
                          verticalAlign: "middle",
                        }}
                      >
                        {result !== null ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                                color: "var(--rf-text-3)",
                              }}
                            >
                              {mode}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                fontFamily: "var(--rf-font-mono)",
                                color: "var(--rf-accent)",
                              }}
                            >
                              {result}
                            </span>
                          </div>
                        ) : col.type === "number" ? (
                          <button
                            style={{
                              fontSize: 10,
                              color: "var(--rf-text-3)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            onClick={() => grid.setAggregation(colKey, "sum")}
                            title="Click to add aggregation"
                          >
                            +
                          </button>
                        ) : null}
                      </td>
                    );
                  })}
                  <td style={{}} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {/* end scroll container */}

        {/* ── FOOTER ──────────────────────────────────────── */}
        <div className="border-t border-rf-border bg-rf-header px-4 py-2 rf-flex rf-items-center rf-justify-between rf-gap-3 rf-flex-wrap">
          <div className="rf-flex rf-gap-4 rf-flex-wrap rf-items-center">
            {[
              {
                label: "Records",
                val:
                  grid.totalRows !== grid.rows.length
                    ? `${grid.rows.length} / ${grid.totalRows}`
                    : grid.rows.length,
              },
              { label: "Unsaved", val: dirtyCount },
              { label: "Selected", val: grid.selectedIds.size },
            ].map(({ label, val }) => (
              <div
                key={label}
                className="rf-flex rf-items-center rf-gap-1 text-[11.5px] text-rf-text-3"
              >
                {label}
                <span className="rf-font-semibold rf-font-mono text-rf-text-2">
                  {val}
                </span>
              </div>
            ))}
            {/* isFetchingMore — inline spinner in footer */}
            {grid.isFetchingMore && (
              <div className="rf-flex rf-items-center rf-gap-1.5 text-[11.5px] text-rf-accent">
                <div
                  className="rf-icon-sm border-2 border-rf-accent border-t-transparent rounded-full"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Loading more…
              </div>
            )}
          </div>
          <span className="text-[11px] text-rf-text-3">
            Click cell to edit · Tab/Enter confirm · Esc cancel · ↑↓←→ navigate
          </span>
        </div>
      </div>

      {/* ── KB HINT ─────────────────────────────────────── */}
      {kb.kbFocusRowId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-[#F1F5F9] rounded-rf-xl px-4 py-2.5 rf-flex rf-items-center rf-gap-3 shadow-rf-lg z-[800] text-[11.5px] rf-font-medium rf-pointer-events-none">
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            ↑↓←→
          </kbd>{" "}
          Navigate
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Enter
          </kbd>{" "}
          Edit
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Space
          </kbd>{" "}
          Detail panel
          <kbd className="bg-white/15 rounded px-1.5 py-0.5 rf-font-mono text-[10.5px] rf-font-semibold">
            Esc
          </kbd>{" "}
          Exit
        </div>
      )}

      {/* ── DETAIL PANEL (ReaktiformPanel) ───────────────────────── */}
      {props.features?.sidePanel !== false &&
        (() => {
          const panelRow =
            grid.rows.find((r) => r._id === grid.panelRowId) ?? null;
          const panelIdx = grid.rows.findIndex(
            (r) => r._id === grid.panelRowId,
          );
          return (
            <ReaktiformPanel
              row={panelRow as Row<TData> | null}
              columns={props.columns}
              rowIdKey={props.rowIdKey ?? "id"}
              isOpen={!!grid.panelRowId}
              canGoPrev={panelIdx > 0}
              canGoNext={panelIdx < grid.rows.length - 1}
              onPrev={() => {
                if (panelIdx > 0) grid.openPanel(grid.rows[panelIdx - 1]!._id);
              }}
              onNext={() => {
                if (panelIdx < grid.rows.length - 1)
                  grid.openPanel(grid.rows[panelIdx + 1]!._id);
              }}
              onClose={grid.closePanel}
              onFieldChange={(rowId, field, value) => {
                // Called on every keystroke in the panel form —
                // marks the field dirty so the table reflects changes live
                grid.markDirty(rowId, field, value);
              }}
              onSave={(rowId, _data) => {
                // All fields are already dirty from onFieldChange above.
                // Just call saveRow — it reads from the existing _draft.
                void grid.saveRow(rowId);
              }}
              onDiscard={(rowId) => grid.discardRow(rowId)}
              panelTabs={grid.panelTabs ?? undefined}
              canSave={grid.permissions.canSave}
              canEdit={grid.permissions.canEditRow(
                (panelRow as Record<string, unknown>) ?? {},
              )}
              canComment={grid.permissions.canComment}
              canUploadFiles={grid.permissions.canUploadFiles}
              {...(props.onAddComment !== undefined && {
                onAddComment: props.onAddComment,
              })}
              {...(props.onUploadFile !== undefined && {
                onUploadFile: props.onUploadFile,
              })}
              {...(props.onDeleteAttachment !== undefined && {
                onDeleteAttachment: props.onDeleteAttachment,
              })}
            />
          );
        })()}

      {/* ── FILTER PANEL ────────────────────────────────── */}
      {filterCol &&
        (() => {
          const col = props.columns.find((c) => c.key === filterCol);
          if (!col) return null;
          const current = grid.activeFilters[filterCol];
          return (
            <FilterPanel
              col={col as ColumnDef}
              current={current}
              anchor={filterAnchor}
              onApply={(val) => {
                grid.setFilter(filterCol, val);
                setFilterCol(null);
              }}
              onClear={() => {
                grid.clearFilter(filterCol);
                setFilterCol(null);
              }}
              onClose={() => {
                setFilterCol(null);
                setFilterAnchor(null);
              }}
            />
          );
        })()}

      {/* ── CF PANEL ────────────────────────────────────── */}
      {cfPanelOpen && (
        <CFPanel
          anchor={cfAnchor}
          columns={props.columns as ColumnDef[]}
          rules={grid.cfRules}
          onAddRule={grid.addCFRule}
          onUpdateRule={grid.updateCFRule}
          onDeleteRule={grid.deleteCFRule}
          onClose={() => setCfPanelOpen(false)}
        />
      )}

      {/* ── COLUMN VISIBILITY PANEL ─────────────────────── */}
      {colVisPanelOpen && (
        <ColumnVisibilityPanel
          columns={orderedColumns as ColumnDef[]}
          hiddenColumns={grid.hiddenColumns}
          anchor={colVisAnchor}
          onToggle={(key) => grid.toggleHide(key)}
          onShowAll={() => {
            [...grid.hiddenColumns].forEach((k) => grid.toggleHide(k));
          }}
          onReorder={(newOrder) => grid.setColumnOrder(newOrder)}
          onClose={() => setColVisPanelOpen(false)}
        />
      )}

      {/* ── CSS Keyframes ───────────────────────────────── */}
      <style>{`
        @keyframes rfFetch {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes rfPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes rfSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  COLUMN HEADER (2-row layout)
// ─────────────────────────────────────────────────────────────
type ColumnHeaderProps = {
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
  onSort: (e: React.MouseEvent) => void;
  sortPriority?: number; // position in multi-sort stack (1-based), undefined = not in stack
  onTogglePin: () => void;
  onToggleGroup: () => void;
  onOpenFilter: (btn: HTMLButtonElement) => void;
  onResize: (width: number) => void;
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
        onResize(w);
      }
    };

    const onUp = (me: MouseEvent) => {
      resizing.current = false;
      const w = Math.max(60, startW.current + (me.clientX - startX.current));
      onResize(w);
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

        {/* Label + sort — clicking here sorts */}
        <div
          className="rf-flex-1 rf-flex rf-items-center rf-gap-1 rf-min-w-0 rf-cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => onSort(e)}
          title={`${sortTooltip} · Shift+click for multi-column sort`}
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
          <SortIcon
            className={cn(
              "w-[11px] h-[11px] flex-shrink-0 transition-opacity",
              isSorted
                ? "opacity-100 text-rf-accent"
                : "opacity-0 hover:opacity-100",
            )}
          />
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
      </div>
    </th>
  );
}

// Memoize ColumnHeader — it renders N times (one per column) and re-renders
// on every scroll event because the parent virtualizer fires. With React.memo
// it only re-renders when its own props change (sort/filter/pin state etc.)
// This is the single biggest scroll-performance win in the entire component.
const ColumnHeaderMemo = React.memo(ColumnHeader);

// ─────────────────────────────────────────────────────────────
//  ERROR POPOVER — rendered via React Portal into document.body
//  This is the ONLY reliable way to escape:
//  - overflow:hidden/auto on the scroll container
//  - position:relative stacking contexts on parent elements
//  - z-index battles with sticky thead
//  The popover measures its trigger button's position via
//  getBoundingClientRect() and positions itself relative to the viewport.
// ─────────────────────────────────────────────────────────────
function ErrorPopover({
  rowId,
  errors,
  saveError,
  columns,
  onClose,
}: {
  rowId: string;
  errors: Record<string, string>;
  saveError?: string | undefined; // API error message from last failed save
  columns: ColumnDef[];
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(
      `[data-error-dot="${rowId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: Math.min(rect.bottom + 6, window.innerHeight - 300),
      left: rect.right + 8,
    });
  }, [rowId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!pos) return null;

  const errorEntries = Object.entries(errors);
  const hasValidation = errorEntries.length > 0;
  const totalProblems = errorEntries.length + (saveError ? 1 : 0);

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 99998 }}
        onClick={onClose}
      />
      <div
        data-reaktiform
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          zIndex: 99999,
          background: "var(--rf-surface)",
          border: "1px solid var(--rf-err-br)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(220,38,38,.20)",
          padding: "10px 14px",
          minWidth: 240,
          maxWidth: 360,
          fontFamily: "var(--rf-font-sans)",
          fontSize: 13,
          color: "var(--rf-text-1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle
              style={{
                width: 12,
                height: 12,
                color: "var(--rf-err)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: "var(--rf-err)",
              }}
            >
              {totalProblems} {totalProblems === 1 ? "Error" : "Errors"}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--rf-text-3)",
              padding: 2,
              display: "flex",
            }}
          >
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* API save error — shown at the top, most important */}
        {saveError && (
          <div
            style={{
              marginBottom: hasValidation ? 10 : 0,
              paddingBottom: hasValidation ? 10 : 0,
              borderBottom: hasValidation
                ? "1px solid var(--rf-err-br)"
                : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  color: "var(--rf-text-3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--rf-err)",
                    flexShrink: 0,
                  }}
                />
                API Error
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--rf-err)",
                  lineHeight: 1.5,
                  background: "var(--rf-err-bg)",
                  borderRadius: 6,
                  padding: "5px 8px",
                  wordBreak: "break-word",
                }}
              >
                {saveError}
              </span>
            </div>
          </div>
        )}

        {/* Validation errors */}
        {hasValidation && (
          <>
            {saveError && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  color: "var(--rf-text-3)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Validation
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {errorEntries.map(([key, msg]) => {
                const col = columns.find((c) => c.key === key);
                return (
                  <div
                    key={key}
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                        color: "var(--rf-text-3)",
                      }}
                    >
                      {col?.label ?? key}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--rf-err)",
                        lineHeight: 1.4,
                      }}
                    >
                      {msg}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Footer hint */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--rf-err-br)",
            fontSize: 10.5,
            color: "var(--rf-text-3)",
          }}
        >
          {hasValidation
            ? "Click any highlighted cell to fix"
            : "Fix the issue and retry saving"}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
//  COLUMN VISIBILITY PANEL — show/hide + drag-reorder columns
// ─────────────────────────────────────────────────────────────
function ColumnVisibilityPanel({
  columns,
  hiddenColumns,
  onToggle,
  onShowAll,
  onReorder,
  onClose,
  anchor,
}: {
  columns: ColumnDef[];
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onReorder: (newOrder: string[]) => void;
  onClose: () => void;
  anchor?: DOMRect | null;
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
    <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose}>
      <div
        style={{
          ...panelPos,
          width: PANEL_W,
          maxHeight: PANEL_H,
          background: "#FFFFFF",
          border: "1px solid #E2E5ED",
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
            borderBottom: "1px solid #E2E5ED",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#94A3B8",
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
                color: "#0F172A",
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
                  color: "#3B5BDB",
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
                color: "#94A3B8",
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
            color: "#94A3B8",
            display: "flex",
            alignItems: "center",
            gap: 5,
            borderBottom: "1px solid #E2E5ED",
            background: "#F1F3F9",
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
                    "#F8FAFF";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
              >
                {/* Drag handle */}
                <div
                  style={{
                    color: "#94A3B8",
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
                    background: visible ? "#3B5BDB" : "#E2E5ED",
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
                      background: "#fff",
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
                      color: visible ? "#0F172A" : "#94A3B8",
                    }}
                  >
                    {col.label}
                  </span>
                  {col.computed && (
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>
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

// ─────────────────────────────────────────────────────────────
//  ASYNC SELECT FILTER — search box calling loadOptions
//  Used inside FilterPanel for async/creatable columns
// ─────────────────────────────────────────────────────────────
function AsyncSelectFilter({
  loadOptions,
  selected,
  isCreatable,
  onToggle,
}: {
  loadOptions: (input: string) => Promise<import("../../types").SelectOption[]>;
  selected: string[];
  isCreatable: boolean;
  onToggle: (val: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<import("../../types").SelectOption[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const T = {
    border: "#E2E5ED",
    bg: "#F4F6FA",
    text1: "#0F172A",
    text2: "#475569",
    text3: "#94A3B8",
    accent: "#3B5BDB",
    accentBg: "#EEF2FF",
    rowHover: "#F8FAFF",
  };
  const iStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12.5,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    background: T.bg,
    color: T.text1,
    outline: "none",
    fontFamily: "Inter,system-ui,sans-serif",
    boxSizing: "border-box",
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const opts = await loadOptions(query);
        setResults(opts);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadOptions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: T.text2,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        Search to filter
      </label>
      <input
        style={iStyle}
        value={query}
        autoFocus
        placeholder="Type to search options…"
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onToggle(val)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 20,
                background: T.accent,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {results.find((o) => o.value === val)?.label ?? val}
              <X style={{ width: 10, height: 10 }} />
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          maxHeight: 140,
          overflowY: "auto",
          borderRadius: 7,
          border: `1px solid ${T.border}`,
          background: T.bg,
        }}
      >
        {loading && (
          <div
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: T.text3,
              fontStyle: "italic",
            }}
          >
            Loading…
          </div>
        )}
        {!loading && results.length === 0 && query && (
          <div
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: T.text3,
              fontStyle: "italic",
            }}
          >
            No results
          </div>
        )}
        {!loading &&
          results.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  fontSize: 12.5,
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  background: isSel ? T.accentBg : "transparent",
                  color: isSel ? T.accent : T.text1,
                  fontWeight: isSel ? 600 : 400,
                  fontFamily: "Inter,system-ui,sans-serif",
                }}
              >
                {opt.label}
                {isSel && <span style={{ color: T.accent }}>✓</span>}
              </button>
            );
          })}
        {isCreatable && query && !results.find((o) => o.label === query) && (
          <button
            type="button"
            onClick={() => {
              onToggle(query);
              setQuery("");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontSize: 12.5,
              textAlign: "left",
              border: "none",
              borderTop: `1px solid ${T.border}`,
              cursor: "pointer",
              background: "transparent",
              color: T.text2,
              fontFamily: "Inter,system-ui,sans-serif",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: T.accent,
              }}
            >
              + Create
            </span>
            &ldquo;{query}&rdquo;
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CREATABLE FILTER — type and add custom values to filter set
// ─────────────────────────────────────────────────────────────
function CreatableFilter({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (val: string) => void;
}) {
  const [input, setInput] = useState("");
  const T = {
    border: "#E2E5ED",
    bg: "#F4F6FA",
    text1: "#0F172A",
    text2: "#475569",
    accent: "#3B5BDB",
    accentHov: "#2F4AC4",
  };
  const add = () => {
    const v = input.trim();
    if (v) {
      onToggle(v);
      setInput("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: T.text2,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        Filter by value
      </label>
      <div style={{ display: "flex" }}>
        <input
          value={input}
          autoFocus
          placeholder="Type a value…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 12.5,
            border: `1px solid ${T.border}`,
            borderRight: "none",
            borderRadius: "7px 0 0 7px",
            background: T.bg,
            color: T.text1,
            outline: "none",
            fontFamily: "Inter,system-ui,sans-serif",
          }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            padding: "6px 12px",
            background: T.accent,
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${T.accent}`,
            borderRadius: "0 7px 7px 0",
            cursor: "pointer",
            fontFamily: "Inter,system-ui,sans-serif",
          }}
        >
          Add
        </button>
      </div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onToggle(val)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 20,
                background: T.accent,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {val} <X style={{ width: 10, height: 10 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  FILTER PANEL — positions below the column filter button
// ─────────────────────────────────────────────────────────────
function FilterPanel({
  col,
  current,
  anchor,
  onApply,
  onClear,
  onClose,
}: {
  col: ColumnDef;
  current: FilterValue | undefined;
  anchor: DOMRect | null;
  onApply: (val: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [textVal, setTextVal] = useState(
    current?.type === "text" ? current.text : "",
  );
  const [numMin, setNumMin] = useState(
    current?.type === "number" ? String(current.min ?? "") : "",
  );
  const [numMax, setNumMax] = useState(
    current?.type === "number" ? String(current.max ?? "") : "",
  );
  const [dateFrom, setDateFrom] = useState(
    current?.type === "date" ? (current.from ?? "") : "",
  );
  const [dateTo, setDateTo] = useState(
    current?.type === "date" ? (current.to ?? "") : "",
  );
  const [selVals, setSelVals] = useState<string[]>(
    current?.type === "select" ? current.values : [],
  );
  const [boolVal, setBoolVal] = useState<boolean | null>(
    current?.type === "checkbox" ? current.value : null,
  );
  // Rating filter — min/max star range
  const [ratingMin, setRatingMin] = useState<number>(
    current?.type === "number" ? (current.min ?? 0) : 0,
  );
  const [ratingMax, setRatingMax] = useState<number>(
    current?.type === "number" ? (current.max ?? 5) : 5,
  );

  const handleApply = () => {
    // ── text-like types: contains search
    if (col.type === "text" || col.type === "email" || col.type === "url") {
      onApply({ type: "text", text: textVal });

      // ── number-like types: min/max range
    } else if (
      col.type === "number" ||
      col.type === "currency" ||
      col.type === "percentage" ||
      col.type === "progress"
    ) {
      onApply({
        type: "number",
        ...(numMin !== "" && { min: Number(numMin) }),
        ...(numMax !== "" && { max: Number(numMax) }),
      });

      // ── rating: star range stored as number filter
    } else if (col.type === "rating") {
      onApply({
        type: "number",
        ...(ratingMin > 0 && { min: ratingMin }),
        ...(ratingMax < (col.ratingMax ?? 5) && { max: ratingMax }),
      });

      // ── date
    } else if (col.type === "date") {
      onApply({
        type: "date",
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });

      // ── select / multiselect / badge: pill toggles
    } else if (
      col.type === "select" ||
      col.type === "multiselect" ||
      col.type === "badge"
    ) {
      const hasStaticOptions = (col.options?.length ?? 0) > 0;
      const isAsync = !!col.loadOptions;
      if (!hasStaticOptions && !isAsync && textVal) {
        onApply({ type: "text", text: textVal });
      } else {
        onApply({ type: "select", values: selVals });
      }

      // ── checkbox
    } else if (col.type === "checkbox") {
      onApply({ type: "checkbox", value: boolVal });
    }
  };

  // const inp = cn(
  //   "w-full px-2.5 py-1.5 text-[12.5px] border border-rf-border rounded-rf-md",
  //   "bg-rf-bg text-rf-text-1 outline-none",
  //   "focus:border-rf-accent focus:shadow-[0_0_0_3px_rgba(59,91,219,.10)]",
  // );

  const PANEL_WIDTH = 288;
  const PANEL_HEIGHT = 420;
  const panelPos = useAnchoredPosition(anchor, PANEL_WIDTH, PANEL_HEIGHT);

  // Hardcoded tokens — no [data-reaktiform] scope needed since we're in a portal
  const FS = {
    surface: "#FFFFFF",
    header: "#F1F3F9",
    bg: "#F4F6FA",
    border: "#E2E5ED",
    text1: "#0F172A",
    text2: "#475569",
    text3: "#94A3B8",
    accent: "#3B5BDB",
    accentBg: "#EEF2FF",
    accentBr: "#C7D2FE",
    err: "#DC2626",
    radiusMd: "7px",
    radiusLg: "10px",
  };
  const fInp: React.CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    fontSize: 12.5,
    border: `1px solid ${FS.border}`,
    borderRadius: FS.radiusMd,
    background: FS.bg,
    color: FS.text1,
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
  };
  const fLabel: React.CSSProperties = {
    display: "block",
    fontSize: 10.5,
    fontWeight: 700,
    color: FS.text2,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    marginBottom: 6,
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose}>
      <div
        style={{
          ...panelPos,
          width: PANEL_WIDTH,
          maxHeight: PANEL_HEIGHT,
          overflowY: "auto",
          background: FS.surface,
          border: `1px solid ${FS.border}`,
          borderRadius: FS.radiusLg,
          boxShadow: "0 8px 32px rgba(15,23,42,.2)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: `1px solid ${FS.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: FS.text3,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Filter
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: FS.text1,
                marginTop: 1,
              }}
            >
              {col.label}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: FS.text3,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── Body */}
        <div
          style={{
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Text / Email / URL */}
          {(col.type === "text" ||
            col.type === "email" ||
            col.type === "url") && (
            <div>
              <label style={fLabel}>
                {col.type === "email"
                  ? "Email contains"
                  : col.type === "url"
                    ? "URL contains"
                    : "Contains"}
              </label>
              <input
                style={fInp}
                value={textVal}
                autoFocus
                placeholder={
                  col.type === "email"
                    ? "e.g. @gmail.com"
                    : col.type === "url"
                      ? "e.g. github.com"
                      : `Search ${col.label.toLowerCase()}…`
                }
                onChange={(e) => setTextVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApply();
                }}
              />
            </div>
          )}

          {/* Number / Currency / Percentage / Progress range */}
          {(col.type === "number" ||
            col.type === "currency" ||
            col.type === "percentage" ||
            col.type === "progress") && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <label style={fLabel}>
                  {col.type === "percentage" || col.type === "progress"
                    ? "Min %"
                    : `Min ${col.currency ?? ""}`}
                </label>
                <input
                  style={fInp}
                  type="number"
                  value={numMin}
                  placeholder="0"
                  onChange={(e) => setNumMin(e.target.value)}
                />
              </div>
              <div>
                <label style={fLabel}>
                  {col.type === "percentage" || col.type === "progress"
                    ? "Max %"
                    : `Max ${col.currency ?? ""}`}
                </label>
                <input
                  style={fInp}
                  type="number"
                  value={numMax}
                  placeholder="∞"
                  onChange={(e) => setNumMax(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Rating — star range */}
          {col.type === "rating" &&
            (() => {
              const maxStars = col.ratingMax ?? 5;
              return (
                <div>
                  <label style={fLabel}>Minimum rating</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      marginBottom: 12,
                    }}
                  >
                    {Array.from({ length: maxStars }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRatingMin(i + 1)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 22,
                          lineHeight: 1,
                          padding: "0 2px",
                          color: i < ratingMin ? "#F59E0B" : FS.border,
                          transform: i < ratingMin ? "scale(1.1)" : "scale(1)",
                          transition: "all 80ms",
                        }}
                      >
                        ★
                      </button>
                    ))}
                    {ratingMin > 0 && (
                      <button
                        type="button"
                        onClick={() => setRatingMin(0)}
                        style={{
                          fontSize: 11,
                          color: FS.text3,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          marginLeft: 4,
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <label style={fLabel}>Maximum rating</label>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 2 }}
                  >
                    {Array.from({ length: maxStars }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRatingMax(i + 1)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 22,
                          lineHeight: 1,
                          padding: "0 2px",
                          color: i < ratingMax ? "#F59E0B" : FS.border,
                          transform: i < ratingMax ? "scale(1.1)" : "scale(1)",
                          transition: "all 80ms",
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: FS.text3, marginTop: 6 }}>
                    Showing {ratingMin}★ – {ratingMax}★
                  </div>
                </div>
              );
            })()}

          {/* Date range */}
          {col.type === "date" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <label style={fLabel}>From</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label style={fLabel}>To</label>
                <input
                  style={{ ...fInp, fontFamily: "monospace" }}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Select / Multiselect / Badge */}
          {(col.type === "select" ||
            col.type === "multiselect" ||
            col.type === "badge") &&
            (() => {
              const hasStaticOptions = (col.options?.length ?? 0) > 0;
              const isAsync = !!col.loadOptions;
              const isCreatable = !!col.onCreateOption;

              if (hasStaticOptions && !isAsync)
                return (
                  <div>
                    <label style={fLabel}>Include any of</label>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        maxHeight: 180,
                        overflowY: "auto",
                      }}
                    >
                      {(col.options ?? []).map((opt) => {
                        const isSel = selVals.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setSelVals(
                                isSel
                                  ? selVals.filter((v) => v !== opt.value)
                                  : [...selVals, opt.value],
                              )
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 500,
                              padding: "4px 10px",
                              borderRadius: 20,
                              border: `1px solid ${isSel ? FS.accent : FS.border}`,
                              background: isSel ? FS.accent : FS.header,
                              color: isSel ? "#fff" : FS.text2,
                              cursor: "pointer",
                              transition: "all 120ms",
                            }}
                          >
                            {isSel && <span>✓</span>}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );

              if (isAsync)
                return (
                  <AsyncSelectFilter
                    loadOptions={col.loadOptions!}
                    selected={selVals}
                    isCreatable={isCreatable}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );

              if (isCreatable)
                return (
                  <CreatableFilter
                    selected={selVals}
                    onToggle={(val) =>
                      setSelVals((prev) =>
                        prev.includes(val)
                          ? prev.filter((v) => v !== val)
                          : [...prev, val],
                      )
                    }
                  />
                );

              return (
                <div>
                  <label style={fLabel}>Contains</label>
                  <input
                    style={fInp}
                    value={textVal}
                    autoFocus
                    placeholder="Filter value…"
                    onChange={(e) => setTextVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApply();
                    }}
                  />
                </div>
              );
            })()}

          {/* Checkbox */}
          {col.type === "checkbox" && (
            <div>
              <label style={fLabel}>Value</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([null, true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setBoolVal(v)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: FS.radiusMd,
                      border: `1px solid ${boolVal === v ? FS.accent : FS.border}`,
                      background: boolVal === v ? FS.accent : FS.surface,
                      color: boolVal === v ? "#fff" : FS.text2,
                      cursor: "pointer",
                      transition: "all 120ms",
                    }}
                  >
                    {v === null ? "All" : v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer */}
        <div style={{ display: "flex", gap: 8, padding: "0 14px 14px" }}>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              padding: "7px 0",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: FS.radiusMd,
              border: "none",
              background: FS.accent,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Apply
          </button>
          <button
            onClick={onClear}
            style={{
              padding: "7px 16px",
              fontSize: 12.5,
              fontWeight: 500,
              borderRadius: FS.radiusMd,
              border: `1px solid ${FS.border}`,
              background: FS.surface,
              color: FS.text2,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
//  CF PANEL — conditional formatting rules editor
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  SMART POPUP POSITION
//  Computes the best position for a popup anchored to a button.
//  - Prefers to open BELOW the button, left-aligned
//  - Falls back to ABOVE if not enough space below
//  - Clamps horizontally so panel never goes off screen right edge
// ─────────────────────────────────────────────────────────────
/**
 * Compute fixed position for a panel anchored to a button.
 *
 * Strategy:
 *  1. Try to open BELOW the button, right-aligned with its right edge
 *  2. If panel would overflow the right edge, align left edge instead
 *  3. If panel would overflow bottom, flip ABOVE the button
 *  4. Always clamp to viewport bounds with 8px margin
 */
function useAnchoredPosition(
  anchor: DOMRect | null,
  panelWidth: number,
  panelHeight: number,
  gap = 6,
): React.CSSProperties {
  if (!anchor) {
    // Should not happen — both panels only render when anchor is set.
    // Fallback: below toolbar, right-aligned
    return { position: "fixed", top: 56 + gap, right: 8 };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Vertical: prefer below, flip above if no space
  let top = anchor.bottom + gap;
  if (top + panelHeight > vh - 8) {
    top = anchor.top - panelHeight - gap;
  }
  top = Math.max(8, top);

  // ── Horizontal: right-align panel to button's right edge by default
  // (looks natural for toolbar buttons on the right side)
  let left = anchor.right - panelWidth;

  // If that pushes panel off left edge, left-align with button instead
  if (left < 8) {
    left = anchor.left;
  }

  // If still overflows right (very narrow viewport), clamp to right margin
  if (left + panelWidth > vw - 8) {
    left = vw - panelWidth - 8;
  }

  // Final left clamp
  left = Math.max(8, left);

  return { position: "fixed", top, left };
}

// ─────────────────────────────────────────────────────────────
//  CF PRESET COLORS — quick-pick swatches
// ─────────────────────────────────────────────────────────────
const CF_COLORS = [
  { label: "Red", bg: "#FFF1F2", text: "#991B1B" },
  { label: "Orange", bg: "#FFF7ED", text: "#9A3412" },
  { label: "Yellow", bg: "#FEFCE8", text: "#854D0E" },
  { label: "Green", bg: "#F0FDF4", text: "#166534" },
  { label: "Blue", bg: "#EFF6FF", text: "#1E40AF" },
  { label: "Purple", bg: "#FAF5FF", text: "#6B21A8" },
  { label: "Teal", bg: "#F0FDFA", text: "#115E59" },
  { label: "Pink", bg: "#FFF0F6", text: "#9D174D" },
];

// ─────────────────────────────────────────────────────────────
//  COLOR UTILITIES for CF color picker
// ─────────────────────────────────────────────────────────────

/** Convert hex to HSL */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Convert HSL to hex */
function hslToHex(h: number, s: number, l: number): string {
  const hh = h / 360,
    ss = s / 100,
    ll = l / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Given any picked hex color, produce a light-shade background
 * (L clamped to 88–96%) and a matching dark text color (L ~20–30%).
 * This ensures the row highlight is always a soft pastel,
 * never a dark or saturated color that hides text.
 */
function buildCFColors(pickedHex: string): { bg: string; text: string } {
  const [h, s] = hexToHsl(pickedHex);
  // Background: same hue, reduced saturation, very light
  const bgL = 93; // lightness 93% → always a soft pastel
  const bgS = Math.min(s, 65); // cap saturation so it stays light
  // Text: same hue, high saturation, dark
  const textL = 22;
  const textS = Math.min(s + 10, 90);
  return {
    bg: hslToHex(h, bgS, bgL),
    text: hslToHex(h, textS, textL),
  };
}

/** For W3C luminance check — used only for preset swatches */
// function deriveTextColor(hexBg: string): string {
//   const [, , l] = hexToHsl(hexBg);
//   return l > 55 ? "#1E293B" : "#F8FAFC";
// }

// ─────────────────────────────────────────────────────────────
//  OPERATORS filtered by column type
// ─────────────────────────────────────────────────────────────
const CF_OPS_TEXT = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
];
const CF_OPS_NUMBER = [
  { value: "eq", label: "= equals" },
  { value: "neq", label: "≠ not equals" },
  { value: "gt", label: "> greater than" },
  { value: "gte", label: "≥ at least" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "≤ at most" },
];
const CF_OPS_SELECT = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is one of" },
];
const CF_OPS_BOOL = [{ value: "eq", label: "is" }];
const CF_OPS_DATE = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "after" },
  { value: "gte", label: "on or after" },
  { value: "lt", label: "before" },
  { value: "lte", label: "on or before" },
];

function getCFOps(type: ColumnDef["type"] | undefined) {
  if (!type) return CF_OPS_TEXT;
  if (["select", "multiselect", "badge"].includes(type)) return CF_OPS_SELECT;
  if (["checkbox"].includes(type)) return CF_OPS_BOOL;
  if (["number", "currency", "percentage", "rating", "progress"].includes(type))
    return CF_OPS_NUMBER;
  if (type === "date") return CF_OPS_DATE;
  return CF_OPS_TEXT;
}

// ─────────────────────────────────────────────────────────────
//  SMART CONDITION VALUE INPUT
//  Renders the right input control based on field type + operator
// ─────────────────────────────────────────────────────────────
function CFConditionValueInput({
  col,
  op,
  value,
  onChange,
  inp,
}: {
  col: ColumnDef | undefined;
  op: string;
  value: string;
  onChange: (v: string) => void;
  inp: string;
}) {
  const type = col?.type;

  // select/multiselect/badge + eq/neq → dropdown of options
  if (
    (type === "select" || type === "multiselect" || type === "badge") &&
    (op === "eq" || op === "neq") &&
    col?.options?.length
  ) {
    return (
      <select
        className={cn(inp, "flex-1 min-w-[80px]")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— any —</option>
        {col.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // select/multiselect + "is one of" → multi-checkbox list
  if (
    (type === "select" || type === "multiselect" || type === "badge") &&
    op === "in" &&
    col?.options?.length
  ) {
    const selected = value
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const toggle = (v: string) => {
      const next = selected.includes(v)
        ? selected.filter((s) => s !== v)
        : [...selected, v];
      onChange(next.join(","));
    };
    return (
      <div className="rf-flex-wrap rf-gap-1 rf-flex-1">
        {col.options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 20,
                padding: "2px 8px",
                border: "1px solid",
                background: isSel ? "var(--rf-accent)" : "var(--rf-header)",
                color: isSel ? "#fff" : "var(--rf-text-2)",
                borderColor: isSel ? "var(--rf-accent)" : "var(--rf-border)",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // checkbox → Yes / No buttons
  if (type === "checkbox") {
    return (
      <div className="rf-flex rf-gap-1 rf-flex-1">
        {["true", "false"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: "2px 0",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid",
              background:
                value === v ? "var(--rf-accent)" : "var(--rf-surface)",
              color: value === v ? "#fff" : "var(--rf-text-2)",
              borderColor:
                value === v ? "var(--rf-accent)" : "var(--rf-border)",
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            {v === "true" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  // date → date input
  if (type === "date") {
    return (
      <input
        type="date"
        className={cn(inp, "flex-1")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // number-like → number input with optional min/max
  // resolveConstraint resolves static values and calls function constraints
  // with an empty row (CF condition inputs have no row context).
  if (
    ["number", "currency", "percentage", "rating", "progress"].includes(
      type ?? "",
    )
  ) {
    const resolvedMin =
      col?.min !== undefined
        ? resolveConstraint(col.min, {} as Row<Record<string, unknown>>)
        : undefined;
    const resolvedMax =
      col?.max !== undefined
        ? resolveConstraint(col.max, {} as Row<Record<string, unknown>>)
        : undefined;
    return (
      <input
        type="number"
        className={cn(inp, "flex-1")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        {...(resolvedMin !== undefined && { min: resolvedMin })}
        {...(resolvedMax !== undefined && { max: resolvedMax })}
      />
    );
  }

  // default → text input
  return (
    <input
      type="text"
      className={cn(inp, "flex-1")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value…"
    />
  );
}

// ─────────────────────────────────────────────────────────────
//  CFPanel
// ─────────────────────────────────────────────────────────────
function CFPanel({
  columns,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
  anchor,
}: {
  columns: ColumnDef[];
  rules: CFRule[];
  onAddRule: () => void;
  onUpdateRule: (id: string, updates: Partial<CFRule>) => void;
  onDeleteRule: (id: string) => void;
  onClose: () => void;
  anchor?: DOMRect | null;
}) {
  const inp = cn(
    "px-2 py-1 text-[12px] border border-rf-border rounded-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none focus:border-rf-accent",
  );

  const CF_PANEL_W = 520;
  const CF_PANEL_H = Math.min(560, window.innerHeight * 0.82);
  const panelPos = useAnchoredPosition(anchor ?? null, CF_PANEL_W, CF_PANEL_H);

  const updateCond = (
    rule: CFRule,
    ci: number,
    patch: Partial<{ field: string; op: string; value: string }>,
  ) => {
    const conds = rule.conditions.map((c, i) =>
      i === ci ? { ...c, ...patch } : c,
    ) as CFCondition[];
    onUpdateRule(rule.id, { conditions: conds });
  };

  // ── Inline style tokens — no dependency on Tailwind or [data-reaktiform] scope
  const S = {
    surface: "#FFFFFF",
    header: "#F1F3F9",
    bg: "#F4F6FA",
    border: "#E2E5ED",
    text1: "#0F172A",
    text2: "#475569",
    text3: "#94A3B8",
    accent: "#3B5BDB",
    accentBg: "#EEF2FF",
    accentBr: "#C7D2FE",
    err: "#DC2626",
    errBg: "#FFF1F2",
    purple: "#7C3AED",
    radiusMd: "7px",
    radiusLg: "10px",
  };
  const inpStyle: React.CSSProperties = {
    padding: "4px 8px",
    fontSize: 12,
    border: `1px solid ${S.border}`,
    borderRadius: S.radiusMd,
    background: S.bg,
    color: S.text1,
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
    transition: "border-color 120ms",
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 900 }} onClick={onClose}>
      <div
        style={{
          ...panelPos,
          width: CF_PANEL_W,
          maxHeight: CF_PANEL_H,
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: S.radiusLg,
          boxShadow: "0 8px 40px rgba(15,23,42,.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          zIndex: 901,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 16px",
            borderBottom: `1px solid ${S.border}`,
            background: S.header,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Palette style={{ width: 15, height: 15, color: S.purple }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: S.text1 }}>
              Conditional Formatting
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: S.text3,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── Rules list — scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rules.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                fontSize: 12.5,
                color: S.text3,
                fontStyle: "italic",
              }}
            >
              No rules yet. Add a rule to highlight rows based on conditions.
            </div>
          )}

          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                border: `1px solid ${S.border}`,
                borderRadius: S.radiusLg,
                padding: 12,
                background: S.bg,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* ── Rule name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { enabled: e.target.checked })
                  }
                  style={{
                    width: 13,
                    height: 13,
                    accentColor: S.accent,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <input
                  value={rule.label}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { label: e.target.value })
                  }
                  placeholder="Rule name…"
                  style={{ ...inpStyle, flex: 1 }}
                />
                <select
                  value={rule.logic}
                  onChange={(e) =>
                    onUpdateRule(rule.id, {
                      logic: e.target.value as "AND" | "OR",
                    })
                  }
                  style={{ ...inpStyle, paddingRight: 4 }}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: S.text3,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = S.err;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      S.errBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      S.text3;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {/* ── Conditions */}
              {rule.conditions.map((cond, ci) => {
                const col = columns.find(
                  (c) => (c.key as string) === cond.field,
                );
                const ops = getCFOps(col?.type);
                const safeOp = ops.find((o) => o.value === cond.op)
                  ? cond.op
                  : (ops[0]?.value ?? "eq");

                return (
                  <div
                    key={ci}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Field */}
                    <select
                      style={{ ...inpStyle, flex: 1, minWidth: 110 }}
                      value={cond.field}
                      onChange={(e) => {
                        const newCol = columns.find(
                          (c) => (c.key as string) === e.target.value,
                        );
                        const newOps = getCFOps(newCol?.type);
                        const newOp = newOps[0]?.value ?? "eq";
                        updateCond(rule, ci, {
                          field: e.target.value,
                          op: newOp as string,
                          value: "",
                        });
                      }}
                    >
                      {columns
                        .filter((c) => !c.computed)
                        .map((c) => (
                          <option key={c.key as string} value={c.key as string}>
                            {c.label}
                          </option>
                        ))}
                    </select>

                    {/* Operator */}
                    <select
                      style={{ ...inpStyle, minWidth: 100 }}
                      value={safeOp}
                      onChange={(e) =>
                        updateCond(rule, ci, { op: e.target.value, value: "" })
                      }
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Smart value input */}
                    <CFConditionValueInput
                      col={col}
                      op={safeOp}
                      value={cond.value}
                      onChange={(v) => updateCond(rule, ci, { value: v })}
                      inp={inp}
                    />

                    {/* Remove */}
                    {rule.conditions.length > 1 && (
                      <button
                        onClick={() =>
                          onUpdateRule(rule.id, {
                            conditions: rule.conditions.filter(
                              (_, i) => i !== ci,
                            ),
                          })
                        }
                        style={{
                          width: 22,
                          height: 22,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: S.text3,
                          borderRadius: 4,
                          marginTop: 2,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            S.err)
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            S.text3)
                        }
                      >
                        <X style={{ width: 11, height: 11 }} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* ── Add condition link */}
              <button
                onClick={() =>
                  onUpdateRule(rule.id, {
                    conditions: [
                      ...rule.conditions,
                      {
                        field:
                          (columns.find((c) => !c.computed)?.key as string) ??
                          "",
                        op: "eq",
                        value: "",
                      },
                    ],
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11.5,
                  color: S.accent,
                  padding: 0,
                  textAlign: "left",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                + Add condition
              </button>

              {/* ── Color picker section */}
              <div
                style={{
                  paddingTop: 10,
                  borderTop: `1px solid ${S.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: S.text3,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  Highlight color
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Preset swatches */}
                  {CF_COLORS.map((preset) => {
                    const active = rule.backgroundColor === preset.bg;
                    return (
                      <button
                        key={preset.label}
                        title={preset.label}
                        onClick={() =>
                          onUpdateRule(rule.id, {
                            backgroundColor: preset.bg,
                            textColor: preset.text,
                          })
                        }
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          cursor: "pointer",
                          background: preset.bg,
                          border: `2px solid ${active ? S.accent : preset.bg}`,
                          boxShadow: active
                            ? `0 0 0 2px ${S.accentBr}`
                            : "inset 0 0 0 1px rgba(0,0,0,.12)",
                          transform: active ? "scale(1.2)" : "scale(1)",
                          transition: "all 120ms ease",
                        }}
                      />
                    );
                  })}

                  {/* Separator */}
                  <div
                    style={{
                      width: 1,
                      height: 20,
                      background: S.border,
                      flexShrink: 0,
                    }}
                  />

                  {/* Custom color picker */}
                  <label
                    title="Pick custom color — auto-converted to a light pastel"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      cursor: "pointer",
                      border: `2px dashed ${S.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                      background: !CF_COLORS.some(
                        (p) => p.bg === rule.backgroundColor,
                      )
                        ? rule.backgroundColor
                        : S.header,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: S.text3,
                        lineHeight: 1,
                        userSelect: "none",
                      }}
                    >
                      ✎
                    </span>
                    <input
                      type="color"
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                        width: "100%",
                        height: "100%",
                      }}
                      value={
                        rule.backgroundColor.startsWith("#") &&
                        rule.backgroundColor.length === 7
                          ? rule.backgroundColor
                          : "#EEF2FF"
                      }
                      onChange={(e) => {
                        const { bg, text } = buildCFColors(e.target.value);
                        onUpdateRule(rule.id, {
                          backgroundColor: bg,
                          textColor: text,
                        });
                      }}
                    />
                  </label>

                  {/* Live preview */}
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, color: S.text3 }}>
                      Preview:
                    </span>
                    <div
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: rule.backgroundColor,
                        color: rule.textColor,
                        border: `1px solid ${rule.backgroundColor}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
                      }}
                    >
                      Row highlight
                    </div>
                  </div>
                </div>

                {/* Custom hex info */}
                {!CF_COLORS.some((p) => p.bg === rule.backgroundColor) && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 11, color: S.text3 }}>
                      Custom:
                    </span>
                    <code
                      style={{
                        fontSize: 11,
                        fontFamily: "JetBrains Mono, Fira Code, monospace",
                        background: S.header,
                        borderRadius: 4,
                        padding: "2px 6px",
                        color: S.text2,
                        border: `1px solid ${S.border}`,
                      }}
                    >
                      bg: {rule.backgroundColor} · text: {rule.textColor}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 16px",
            borderTop: `1px solid ${S.border}`,
            background: S.header,
          }}
        >
          <button
            onClick={onAddRule}
            style={{
              width: "100%",
              padding: "8px 0",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: S.radiusMd,
              border: `2px dashed ${S.border}`,
              background: "transparent",
              color: S.text2,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = S.accent;
              b.style.color = S.accent;
              b.style.background = S.accentBg;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = S.border;
              b.style.color = S.text2;
              b.style.background = "transparent";
            }}
          >
            + Add Rule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC Reaktiform — wraps inner with store provider
//
//  Note: React.memo on a generic component requires a cast trick.
//  ReaktiformInner is the performance-critical component — it only
//  re-renders when GridConfig props actually change.
// ─────────────────────────────────────────────────────────────
export function Reaktiform<TData = Record<string, unknown>>(
  props: GridConfig<TData>,
) {
  return (
    <GridStoreProvider
      {...(props.storageKey !== undefined && { storageKey: props.storageKey })}
    >
      <ReaktiformInner {...props} />
    </GridStoreProvider>
  );
}
