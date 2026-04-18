# reaktiform

**High-performance inline-editable data grid + form panel for React.**  
Table and detail panel unified — server-side or client-side, full UI or headless.

[![npm](https://img.shields.io/npm/v/reaktiform)](https://www.npmjs.com/package/reaktiform)
[![bundle size](https://img.shields.io/bundlephobia/minzip/reaktiform)](https://bundlephobia.com/package/reaktiform)
[![license](https://img.shields.io/npm/l/reaktiform)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-blue)](https://www.typescriptlang.org)

---

## What is reaktiform?

reaktiform is a React component that combines a **data grid** and a **detail panel form** into one. Click any cell to edit inline. Press Space to open the side panel with a full form. All edits are tracked with undo/redo, validated before saving, and committed to your API.

**Key design principle:** The grid store is the source of truth. Your API callback fires, the grid keeps the edited values without waiting for a refetch. No optimistic update race conditions.

---

## Features

| Category                   | What you get                                                              |
| -------------------------- | ------------------------------------------------------------------------- |
| **Editing**                | Click-to-edit cells, Tab/Enter confirm, Esc cancel, keyboard navigation   |
| **Select fields**          | Static options, async search, creatable, async+creatable, multi-select    |
| **Data loading**           | Client-side or server-side — infinite scroll, sort, filter, global search |
| **Performance**            | TanStack Virtual — 100k+ rows with zero lag                               |
| **Validation**             | Zod-powered, per-field rules, cross-field rules, inline error display     |
| **Undo / Redo**            | Full history stack, Ctrl+Z / Ctrl+Y                                       |
| **Side panel**             | Detail form panel with all fields, auto-generated from column definitions |
| **Computed columns**       | Formula engine with dependency tracking and auto-recalculation            |
| **Conditional formatting** | Rule-based row highlighting with color picker                             |
| **Column management**      | Resize, reorder, pin left, show/hide                                      |
| **Grouping**               | Collapse/expand row groups by any column                                  |
| **Export**                 | CSV and Excel (.xlsx) — async select labels correctly resolved            |
| **Persistence**            | Column widths, filters, pinned columns saved to localStorage              |
| **Save state**             | Spinner + disabled buttons while API call is in-flight                    |
| **Dark mode**              | Automatic via `.dark` class                                               |
| **TypeScript**             | Full generics — `ColumnDef<MyRow>`, `Reaktiform<MyRow>`                   |

---

## Install

```bash
npm install reaktiform
# or
pnpm add reaktiform
```

**Peer dependencies:**

```bash
npm install react react-dom
```

No Tailwind required. No global CSS conflicts. Styles are fully scoped to `[data-reaktiform]`.

---

## Quick Start

```tsx
import { Reaktiform } from "reaktiform";
import type { ColumnDef } from "reaktiform";
import "reaktiform/styles";

// 1. Define your row type
type Project = {
  id: string;
  name: string;
  status: string;
  budget: number;
  dueDate: string;
};

// 2. Define your columns
const columns: ColumnDef<Project>[] = [
  {
    key: "name",
    label: "Project Name",
    type: "text",
    required: true,
    width: 240,
    pinned: true,
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active", color: "success" },
      { value: "on-hold", label: "On Hold", color: "warning" },
      { value: "closed", label: "Closed", color: "default" },
    ],
  },
  {
    key: "budget",
    label: "Budget",
    type: "currency",
    currency: "USD",
    decimals: 2,
  },
  {
    key: "dueDate",
    label: "Due Date",
    type: "date",
  },
];

// 3. Render
export function ProjectGrid() {
  const [data, setData] = useState<Project[]>([]);

  return (
    <Reaktiform<Project>
      columns={columns}
      data={data}
      rowIdKey="id"
      onCreate={async (row) => {
        const saved = await api.post("/projects", row);
        return saved; // merged back so store gets server-generated id
      }}
      onUpdate={async (row) => {
        await api.patch(`/projects/${row.id}`, row);
        // No refetch needed — store already has correct values
      }}
      onDelete={async (id) => {
        await api.delete(`/projects/${id}`);
      }}
      onSaveSuccess={(row, isNew) =>
        toast.success(`${isNew ? "Created" : "Updated"} "${row.name}"`)
      }
      onSaveError={(err) => toast.error(err.message)}
      features={{ undoRedo: true, sidePanel: true, export: true }}
      maxHeight="calc(100vh - 200px)"
    />
  );
}
```

---

## Server-Side Mode (Infinite Scroll + TanStack Query)

For large datasets, enable server-side sorting, filtering, and infinite pagination.

```tsx
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Reaktiform } from "reaktiform";
import type { SortChangeParams, ActiveFilters } from "reaktiform";

const PAGE_SIZE = 30;

function ServerGrid() {
  const [queryParams, setQueryParams] = useState<{
    sortBy?: string;
    sortDir?: "asc" | "desc";
    search?: string;
    filters?: ActiveFilters;
  }>({});

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    refetch,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["projects", queryParams],
    queryFn: ({ pageParam = 0 }) =>
      fetchPage(pageParam, PAGE_SIZE, queryParams),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore
        ? allPages.reduce((sum, p) => sum + p.rows.length, 0)
        : undefined,
  });

  // ⚠️  Always memoize — prevents data-sync effect from overwriting edits
  const rows = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);
  const total = data?.pages[0]?.total ?? rows.length;

  const updateMutation = useMutation({
    mutationFn: (row: Project) => api.put(`/projects/${row.id}`, row),
    // No onSuccess refetch — store is source of truth
  });

  return (
    <Reaktiform<Project>
      columns={columns}
      data={rows}
      rowIdKey="id"
      // Server-side mode
      sortingMode="server"
      totalRows={total}
      pageSize={PAGE_SIZE}
      fetchThreshold={8} // pre-fetch when 8 rows from the end
      // Loading states
      isLoading={isLoading}
      isFetching={isFetching && !isFetchingNextPage}
      isFetchingMore={isFetchingNextPage}
      // Server callbacks
      onSortChange={({ sortBy, sortDir }) =>
        setQueryParams((prev) => ({ ...prev, sortBy, sortDir }))
      }
      onFilterChange={(filters) =>
        setQueryParams((prev) => ({ ...prev, filters }))
      }
      onSearchChange={(search) =>
        setQueryParams((prev) => ({ ...prev, search }))
      }
      onFetchMore={async () => {
        await fetchNextPage();
      }}
      onRefresh={async () => {
        await refetch();
      }}
      // CRUD
      onUpdate={async (row) => updateMutation.mutateAsync(row)}
    />
  );
}
```

---

## Select Fields — Complete Guide

reaktiform supports four select variants. Each is specified by setting `loadOptions` and/or `onCreateOption` on the column definition.

### 1. Static Select

Options are defined upfront. No API calls. Fast.

```tsx
{
  key:   'status',
  label: 'Status',
  type:  'select',
  options: [
    { value: 'PENDING',   label: 'Pending',   color: 'warning' },
    { value: 'APPROVED',  label: 'Approved',  color: 'success' },
    { value: 'REJECTED',  label: 'Rejected',  color: 'danger'  },
  ],
  required: true,
}
```

Stored value: plain string — `"PENDING"`.

---

### 2. Async Select (Server Search)

Options are loaded from an API. Ideal for large reference lists (categories, users, suppliers). Results are **cached at the module level** — the first open fetches, every re-open after that is instant with zero API calls.

```tsx
{
  key:   'category',
  label: 'Category',
  type:  'select',
  required: true,
  loadOptions: async (inputValue) => {
    const res = await fetch(`/api/categories?q=${inputValue}`)
    const data = await res.json()
    // Must return SelectOption[]
    return data.map(c => ({ value: c.id, label: c.name }))
  },
}
```

**Stored value:** `{ value: string, label: string }` — a `SelectOption` object. The label is stored alongside the id so the grid can display the name immediately without a separate fetch.

**In your `toPayload` / save function**, extract what your API needs:

```ts
// Your API expects { id } reference — extract from stored object
category: row.category?.value
  ? { id: row.category.value }
  : null,
```

---

### 3. Creatable Select

Users can create new options directly in the dropdown by typing a new value and pressing Enter.

```tsx
{
  key:   'tag',
  label: 'Tag',
  type:  'select',
  onCreateOption: async (inputLabel) => {
    const created = await api.post('/tags', { name: inputLabel })
    return { value: created.id, label: created.name }  // ← must return SelectOption
  },
  options: existingTags,  // optionally seed with known options
}
```

---

### 4. Async + Creatable Select

Combines server search with the ability to create new options on the fly. The most flexible variant.

```tsx
{
  key:   'supplier',
  label: 'Supplier',
  type:  'select',
  required: true,
  clearable: true,          // ← optional: show ✕ to remove selection
  loadOptions: async (input) => {
    const res = await fetch(`/api/suppliers?q=${input}`)
    return (await res.json()).map(s => ({ value: s.id, label: s.name }))
  },
  onCreateOption: async (name) => {
    const created = await api.post('/suppliers', { name })
    return { value: created.id, label: name }
  },
}
```

---

### 5. Static Multi-Select

```tsx
{
  key:   'tags',
  label: 'Tags',
  type:  'multiselect',
  options: [
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend',  label: 'Backend'  },
    { value: 'devops',   label: 'DevOps'   },
  ],
  clearable: true,
}
```

Stored value: `string[]` — array of selected values.

---

### 6. Async Multi-Select

```tsx
{
  key:   'assignees',
  label: 'Assignees',
  type:  'multiselect',
  clearable: true,
  loadOptions: async (input) => {
    const users = await api.get(`/users?q=${input}`)
    return users.map(u => ({ value: u.id, label: u.name }))
  },
  onCreateOption: async (name) => {
    const user = await api.post('/users/invite', { name })
    return { value: user.id, label: user.name }
  },
}
```

**Stored value:** `SelectOption[]` — array of `{ value, label }` objects. Extract in `toPayload`:

```ts
// Extract ids for the API
assignees: Array.isArray(row.assignees)
  ? row.assignees.map(a => ({ id: a.value }))
  : [],
```

---

### `clearable` — Allow Removing a Selection

By default, once a value is selected it cannot be cleared. Set `clearable: true` on any select column to show an ✕ button:

```tsx
{
  key:      'category',
  type:     'select',
  clearable: true,    // ← user can click ✕ to remove selection
  loadOptions: searchCategories,
}
```

Works on all four variants: static, async, creatable, async+creatable, and their multi-select equivalents.

---

### Select — Data Flow Summary

```
loadOptions  onCreateOption  | Variant               | Stored value
─────────────────────────────┼───────────────────────┼──────────────────────────
   ✗              ✗          | Static select         | "PENDING"
   ✓              ✗          | Async select          | { value: "uuid", label: "BULK" }
   ✗              ✓          | Creatable select      | "my-new-tag"
   ✓              ✓          | Async+creatable       | { value: "uuid", label: "Supplier X" }
   ✗              ✗          | Static multiselect    | ["frontend", "backend"]
   ✓              ✓          | Async multiselect     | [{ value, label }, { value, label }]
```

---

## All Column Definition Props

```ts
type ColumnDef<TData> = {
  // ── Required ──────────────────────────────────────────────
  key: keyof TData & string; // maps to your data field
  label: string; // shown in column header
  type: ColumnType; // see table below

  // ── Layout ────────────────────────────────────────────────
  width?: number; // initial column width (px)
  minWidth?: number; // minimum resize width
  maxWidth?: number; // maximum resize width
  hidden?: boolean; // hide from view initially
  pinned?: boolean; // pin to left side (sticky)
  align?: "left" | "center" | "right";

  // ── Behaviour ─────────────────────────────────────────────
  sortable?: boolean; // default: true
  filterable?: boolean; // default: true
  groupable?: boolean; // default: false
  resizable?: boolean; // default: true
  copyable?: boolean; // click cell to copy value
  editable?: boolean; // default: true

  // ── Validation ────────────────────────────────────────────
  required?: boolean;
  min?: number; // number/date min value
  max?: number; // number/date max value
  minLength?: number; // text min characters
  maxLength?: number; // text max characters
  pattern?: RegExp; // regex validation
  patternMessage?: string; // custom error for pattern
  validate?: (value: unknown, row: TData) => string | undefined;

  // ── Display ───────────────────────────────────────────────
  format?: (value: unknown, row: TData) => string;
  cellClassName?: (value: unknown, row: TData) => string | undefined;
  cellStyle?: (value: unknown, row: TData) => CSSProperties | undefined;
  headerTooltip?: string;
  renderCell?: (value: unknown, row: TData) => ReactNode;
  renderEditCell?: (
    value: unknown,
    row: TData,
    onChange: (v: unknown) => void,
    onCancel: () => void,
  ) => ReactNode;

  // ── Select / Multiselect ──────────────────────────────────
  options?: SelectOption[];
  searchable?: boolean; // show search in dropdown
  clearable?: boolean; // show ✕ to remove selection (default: false)
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;

  // ── Number / Currency / Percentage ────────────────────────
  decimals?: number;
  prefix?: string; // shown before value: 'RM', '$'
  suffix?: string; // shown after value: ' days', '%'
  currency?: string; // ISO 4217: 'USD', 'MYR', 'EUR'
  locale?: string; // BCP 47: 'en-US', 'ms-MY'
  step?: number; // input step size
  aggregation?: "sum" | "avg" | "min" | "max" | "count";

  // ── Rating ────────────────────────────────────────────────
  ratingMax?: number; // default: 5

  // ── Email / URL ───────────────────────────────────────────
  openInNewTab?: boolean; // default: true

  // ── Date ──────────────────────────────────────────────────
  minDate?: string; // ISO date: '2024-01-01'
  maxDate?: string; // ISO date: '2030-12-31'
  dateFormat?: string; // display format

  // ── Text ──────────────────────────────────────────────────
  multiline?: boolean; // textarea instead of input
  rows?: number; // textarea row count

  // ── Computed / Formula ────────────────────────────────────
  computed?: boolean;
  formula?: (row: TData) => unknown;
  dependsOn?: (keyof TData)[];
  editableWhenComputed?: boolean;
  saveComputed?: boolean; // include in API payload
  aggregateComputed?: boolean;

  // ── Value Transform (advanced) ────────────────────────────
  valueTransform?: {
    read?: (raw: unknown) => unknown; // before display
    write?: (val: unknown) => unknown; // before API call
  };
};
```

---

## Column Types

| Type          | Description                               | Edit Widget            |
| ------------- | ----------------------------------------- | ---------------------- |
| `text`        | Plain string                              | Text input             |
| `number`      | Numeric — supports prefix/suffix/decimals | Number input           |
| `select`      | Single dropdown                           | React Select           |
| `multiselect` | Multi-select dropdown                     | React Select (isMulti) |
| `date`        | ISO date string                           | Native date picker     |
| `checkbox`    | Boolean toggle                            | Checkbox               |
| `email`       | Email with mailto link                    | Text input             |
| `url`         | URL with hyperlink                        | Text input             |
| `currency`    | `Intl.NumberFormat` currency display      | Number input           |
| `percentage`  | Number with % and progress bar            | Number input           |
| `rating`      | 1–N star picker                           | Click stars            |
| `badge`       | Read-only colored enum label              | —                      |
| `progress`    | 0–100 progress bar (read-only)            | —                      |

---

## All Grid Props

### Required

| Prop      | Type                 | Description              |
| --------- | -------------------- | ------------------------ |
| `columns` | `ColumnDef<TData>[]` | Column definitions array |
| `data`    | `TData[]`            | Row data array           |

### CRUD Callbacks

| Prop            | Type                                                     | Description                                          |
| --------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| `onCreate`      | `(row: TData) => Promise<TData \| void>`                 | New row save — return saved row to capture server id |
| `onUpdate`      | `(row: TData) => Promise<TData \| void>`                 | Existing row save                                    |
| `onSave`        | `(row: TData, isNew: boolean) => Promise<TData \| void>` | Alternative: single callback for both                |
| `onDelete`      | `(id: string) => Promise<void>`                          | Single row delete                                    |
| `onBulkDelete`  | `(ids: string[]) => Promise<void>`                       | Multiple rows in one API call                        |
| `onBulkSave`    | `(rows: TData[]) => Promise<TData[] \| void>`            | Save All in one API call                             |
| `onSaveSuccess` | `(row: TData, isNew: boolean) => void`                   | Use for toast notifications                          |
| `onSaveError`   | `(err: Error, row: TData, isNew: boolean) => void`       | Use for error toasts                                 |

### Server-Side Mode

| Prop             | Type                            | Default    | Description                          |
| ---------------- | ------------------------------- | ---------- | ------------------------------------ |
| `sortingMode`    | `'client' \| 'server'`          | `'client'` | Server mode disables built-in sort   |
| `totalRows`      | `number`                        | —          | Total record count for scroll sizing |
| `pageSize`       | `number`                        | `50`       | Records per page                     |
| `fetchThreshold` | `number`                        | `10`       | Rows from end before pre-fetching    |
| `onSortChange`   | `(p: SortChangeParams) => void` | —          | Fires when user clicks a header      |
| `onFilterChange` | `(f: ActiveFilters) => void`    | —          | Fires when column filter changes     |
| `onSearchChange` | `(q: string) => void`           | —          | Fires on global search input         |
| `onFetchMore`    | `() => Promise<void>`           | —          | Called when user nears end of list   |
| `onRefresh`      | `() => Promise<void>`           | —          | Powers the Sync button               |

### Loading States

| Prop             | Type      | Description                                |
| ---------------- | --------- | ------------------------------------------ |
| `isLoading`      | `boolean` | Show full skeleton loader                  |
| `isFetching`     | `boolean` | Show top progress bar (background refresh) |
| `isFetchingMore` | `boolean` | Show "Loading more…" indicator             |

### Row Behaviour

| Prop                | Type                                         | Default   | Description                  |
| ------------------- | -------------------------------------------- | --------- | ---------------------------- |
| `rowIdKey`          | `keyof TData`                                | `'id'`    | Unique identifier field      |
| `rowHeight`         | `number`                                     | `46`      | Row height in px             |
| `rowClassName`      | `(row: TData) => string \| undefined`        | —         | Dynamic CSS class per row    |
| `rowStyle`          | `(row: TData) => CSSProperties \| undefined` | —         | Dynamic inline style per row |
| `isRowDisabled`     | `(row: TData) => boolean`                    | —         | Grey out + prevent editing   |
| `isRowSelectable`   | `(row: TData) => boolean`                    | —         | Guard for checkbox selection |
| `selectionMode`     | `'multi' \| 'single' \| 'none'`              | `'multi'` | —                            |
| `onRowClick`        | `(row: TData) => void`                       | —         | Row click handler            |
| `onRowDoubleClick`  | `(row: TData) => void`                       | —         | Row double-click handler     |
| `onSelectionChange` | `(ids: string[], rows: TData[]) => void`     | —         | Fires on selection change    |

### Layout

| Prop                | Type                        | Default                 | Description                |
| ------------------- | --------------------------- | ----------------------- | -------------------------- |
| `maxHeight`         | `string \| number`          | `'calc(100vh - 300px)'` | Scroll area max height     |
| `minHeight`         | `string \| number`          | `380`                   | Scroll area min height     |
| `emptyState`        | `ReactNode`                 | built-in                | Custom empty state         |
| `toolbarLeft`       | `ReactNode`                 | —                       | Slot after search box      |
| `toolbarRight`      | `ReactNode`                 | —                       | Slot before "+ New Record" |
| `renderExpandedRow` | `(row: TData) => ReactNode` | —                       | Content below expanded row |
| `expandedRowHeight` | `number`                    | `240`                   | Height of expanded area    |

### Feature Flags

All features are enabled by default. Disable selectively:

```tsx
<Reaktiform
  features={{
    undoRedo: true, // Ctrl+Z / Ctrl+Y
    sidePanel: true, // Space to open detail panel
    export: true, // CSV + Excel buttons
    columnHide: true, // Show/hide columns
    columnPin: true, // Pin columns left
    columnResize: true, // Drag to resize
    columnReorder: true, // Drag to reorder
    conditionalFormat: true, // Rule-based highlighting
    groupBy: true, // Row grouping
    showRowNumbers: true, // # column
    showSelectColumn: true, // Checkbox column
    showExpanderColumn: true, // > expand button
    showActionsColumn: true, // Save / Discard / Delete per row
    newRecord: true, // "+ New Record" button
    search: true, // Global search box
  }}
/>
```

### Permissions (RBAC)

```tsx
<Reaktiform
  permissions={{
    canCreate: true,
    canSave: true,
    canExport: true,
    canEditRow: (row) => row.status !== "LOCKED", // per-row
    canDeleteRow: (row) => row.createdBy === userId, // per-row
    canDuplicateRow: true,
    canEditCol: (colKey) => colKey !== "id", // per-column
    canComment: true,
    canUploadFiles: true,
  }}
/>
```

### Side Panel

```tsx
<Reaktiform
  panelTabs={["details", "activity", "attachments"]}
  onAddComment={async (rowId, text) => {
    await api.post(`/rows/${rowId}/comments`, { text });
  }}
  onUploadFile={async (rowId, file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/rows/${rowId}/attachments`, form);
  }}
  onDeleteAttachment={async (rowId, attachmentId) => {
    await api.delete(`/rows/${rowId}/attachments/${attachmentId}`);
  }}
/>
```

### Persistence

```tsx
<Reaktiform
  storageKey="my-app-grid-v1" // localStorage key — change when schema changes
/>
```

Reset saved state:

```tsx
import { clearPersistedState } from "reaktiform";
clearPersistedState("my-app-grid-v1");
```

---

## Save Button State

While an API call is in-flight, reaktiform automatically:

- Disables the **Save** / **Save All** / **Discard** buttons
- Shows a spinner on the active Save button
- Prevents duplicate submissions

This is built-in — no extra props needed.

---

## Validation

Validation runs automatically from `ColumnDef`. For custom rules, use `validate`:

```tsx
// Built-in
{ key: 'email', type: 'email', required: true, maxLength: 200 }

// Custom per-field
{
  key: 'endDate',
  type: 'date',
  validate: (value, row) => {
    if (value && row.startDate && value < row.startDate) {
      return 'End date must be after start date'
    }
  }
}
```

Errors appear inline under the cell and in the side panel. Save is blocked until all errors are resolved.

---

## Computed Columns

Formula columns are calculated from other fields and update automatically when dependencies change.

```tsx
{
  key:       'margin',
  label:     'Margin',
  type:      'percentage',
  computed:  true,
  dependsOn: ['revenue', 'cost'],
  formula:   (row) => row.revenue > 0
    ? ((row.revenue - row.cost) / row.revenue) * 100
    : 0,
}
```

---

## Custom Cell Renderers

For full control over display or editing:

```tsx
// Custom read display
{
  key:  'assignee',
  type: 'text',
  renderCell: (value, row) => (
    <div className="flex items-center gap-2">
      <img src={row.avatarUrl} className="w-5 h-5 rounded-full" />
      <span>{String(value)}</span>
    </div>
  ),
}

// Custom edit widget
{
  key: 'color',
  type: 'text',
  renderEditCell: (value, row, onChange, onCancel) => (
    <input
      type="color"
      defaultValue={String(value ?? '#000000')}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCancel}
      autoFocus
    />
  ),
}
```

---

## Headless Mode

Use only the state management with your own UI:

```tsx
import { useReaktiform } from "reaktiform/headless";

function MyCustomGrid() {
  const grid = useReaktiform({
    columns,
    data,
    rowIdKey: "id",
    onUpdate: (row) => api.patch(`/items/${row.id}`, row),
    onCreate: (row) => api.post("/items", row),
  });

  return (
    <div>
      {grid.rows.map((row) => (
        <div key={row._id} style={{ opacity: row._saving ? 0.6 : 1 }}>
          <span>{row.name as string}</span>
          {grid.isDirty(row) && (
            <button
              disabled={!!row._saving}
              onClick={() => grid.saveRow(row._id)}
            >
              {row._saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Available from `useReaktiform`:**

| Property                              | Description                     |
| ------------------------------------- | ------------------------------- |
| `grid.rows`                           | All rows including unsaved      |
| `grid.isDirty(row)`                   | Has unsaved changes             |
| `grid.getErrors(row)`                 | `{ fieldKey: errorMessage }`    |
| `grid.markDirty(rowId, field, value)` | Update a field                  |
| `grid.saveRow(rowId)`                 | Save one row                    |
| `grid.discardRow(rowId)`              | Discard one row's changes       |
| `grid.saveAll()`                      | Save all dirty rows             |
| `grid.discardAll()`                   | Discard all changes             |
| `grid.addRow(defaults?)`              | Add a new row                   |
| `grid.deleteRow(rowId)`               | Delete a row                    |
| `grid.dirtyCount`                     | Number of unsaved rows          |
| `grid.savingCount`                    | Number of rows currently saving |
| `row._saving`                         | `true` while API call in-flight |
| `row._saveError`                      | Last save error message         |

---

## Standalone Cell Components

Use cells inside your own forms or custom UIs:

```tsx
import { SelectCellEdit, DateCellEdit } from "reaktiform/cells";
import "reaktiform/styles";

function MyForm() {
  const [status, setStatus] = useState("");

  return (
    <SelectCellEdit
      value={status}
      options={[
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
      ]}
      isClearable
      onCommit={(value) => setStatus(value)}
      onCancel={() => {}}
    />
  );
}
```

---

## Utility Functions

```tsx
import {
  formatDate,
  formatCurrency,
  formatNumber,
  truncate,
} from "reaktiform/utils";

formatDate("2025-01-15"); // '15 Jan 2025'
formatCurrency(1234.56, "MYR"); // 'RM1,234.56'
formatNumber(1_500_000, { compact: true }); // '1.5M'
truncate("Long text here", 8); // 'Long tex…'
```

---

## Theming

All colors are CSS custom properties scoped to `[data-reaktiform]`. Override on your container:

```css
/* Custom brand color */
.my-app [data-reaktiform] {
  --rf-accent: #7c3aed; /* purple */
  --rf-accent-hover: #6d28d9;
  --rf-accent-bg: #f5f3ff;
  --rf-accent-br: #ddd6fe;
}

/* Custom surface */
.my-app [data-reaktiform] {
  --rf-surface: #fafafa;
  --rf-bg: #f5f5f5;
  --rf-border: #e5e7eb;
}
```

**Available CSS variables:**

| Variable         | Default   | Description                                |
| ---------------- | --------- | ------------------------------------------ |
| `--rf-accent`    | `#3B5BDB` | Primary brand color (buttons, focus rings) |
| `--rf-surface`   | `#FFFFFF` | Card / panel background                    |
| `--rf-bg`        | `#F4F6FA` | Page / cell background                     |
| `--rf-border`    | `#E2E5ED` | All borders                                |
| `--rf-text-1`    | `#0F172A` | Primary text                               |
| `--rf-text-2`    | `#475569` | Secondary text                             |
| `--rf-text-3`    | `#94A3B8` | Placeholder / muted text                   |
| `--rf-ok`        | `#16A34A` | Success color                              |
| `--rf-warn`      | `#D97706` | Warning color                              |
| `--rf-err`       | `#DC2626` | Error color                                |
| `--rf-radius-md` | `8px`     | Border radius for inputs                   |
| `--rf-radius-lg` | `12px`    | Border radius for panels                   |

**Dark mode** is applied automatically when the `dark` class is on `<html>`:

```html
<html class="dark">
  <!-- reaktiform detects .dark and uses the dark palette -->
</html>
```

---

## Keyboard Navigation

| Key                       | Action                               |
| ------------------------- | ------------------------------------ |
| `↑ ↓ ← →`                 | Move focus between cells             |
| `Enter`                   | Start editing the focused cell       |
| `Tab`                     | Confirm edit + move to next cell     |
| `Shift+Tab`               | Confirm edit + move to previous cell |
| `Escape`                  | Cancel edit / close panel            |
| `Space`                   | Open detail side panel               |
| `Ctrl+Z`                  | Undo                                 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo                                 |
| `Shift+Click header`      | Add column to multi-sort             |

---

## Export

Built-in CSV and Excel export. Works correctly with all value types including async select fields — labels are exported, not raw UUIDs.

```tsx
// Basic — built-in buttons in toolbar
<Reaktiform features={{ export: true }} />

// Custom server-side export
<Reaktiform
  onExport={async (format) => {
    if (format === 'xlsx') {
      const url = await api.post('/reports/export', { format: 'xlsx' })
      window.open(url)
    }
  }}
/>
```

---

## TypeScript Reference

```ts
import type {
  ColumnDef, // column definition
  SelectOption, // { value: string, label: string, color?, disabled?, icon? }
  ColumnType, // 'text' | 'number' | 'select' | 'multiselect' | 'date' | ...
  ActiveFilters, // Record<string, FilterValue>
  FilterValue, // { type: 'text', text: string } | { type: 'select', values: string[] } | ...
  SortChangeParams, // { sortBy: string, sortDir: 'asc'|'desc', sortModel: SortEntry[] }
  GridFeatures, // all feature flags
  GridPermissions, // all permission flags
  Row, // TData & RowMeta (internal meta fields prefixed with _)
} from "reaktiform";
```

---

## Common Patterns

### Integrating with React Query

```tsx
const updateMutation = useMutation({
  mutationFn: (row: MyRow) => api.put(`/items/${row.id}`, toPayload(row)),
  // ✅ No onSuccess refetch — store already has correct values
  // ❌ Don't do: onSuccess: () => queryClient.invalidateQueries(...)
  //    This causes a data-sync race where server data overwrites
  //    the store's committed values mid-render.
});
```

### toPayload — Stripping Internal Fields

reaktiform adds internal fields (prefixed `_`) to every row. Strip them before sending to your API:

```ts
function toPayload(row: MyRow): ApiPayload {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    // Async select — send id only
    category: row.category?.value ? { id: row.category.value } : null,
    // Async multiselect — send array of ids
    assignees: row.assignees?.map((a) => ({ id: a.value })) ?? [],
    // All _* fields are automatically excluded since we list fields explicitly
  };
}
```

### mapRow — Server Data to Grid Format

When server returns reference objects, map them to the format reaktiform expects:

```ts
function mapRow(raw: ApiRow): MyRow {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    // Async select — store { value, label } so grid can display label
    category: raw.category?.id
      ? { value: raw.category.id, label: raw.category.name }
      : undefined,
    // Async multiselect — store SelectOption[]
    assignees:
      raw.assignees?.map((u) => ({ value: u.id, label: u.name })) ?? [],
  };
}
```

---

## Changelog

### v1.2.0

- **`clearable` column prop** — add ✕ clear button to any select variant
- **Async select display** — labels shown in read mode without extra API calls
- **Module-level option cache** — re-opening async selects is instant after first load
- **Save state** — spinner + disabled buttons while API call in-flight (`_saving` flag)
- **Export fix** — CSV/Excel correctly exports labels for async select values (not raw UUIDs)
- **Validation fix** — Zod no longer throws "Expected string, received object" for async selects
- **Panel multiselect** — async multiselect now works in side panel form
- **Dropdown z-index** — dropdowns correctly render above all table rows
- **SelectCell cleanup** — eliminated duplicate code, unified single implementation

### v1.1.0

- Server-side sort, filter, search, infinite scroll
- Conditional formatting rule builder
- Column visibility panel with drag-to-reorder
- Filter panel per column
- `onBulkDelete`, `onBulkSave` callbacks
- RBAC permissions — per-row and per-column

### v1.0.0

- Initial release

---

## License

MIT © [Surya Baskaran](https://github.com/suryabaskaran15)

---

## Links

- **npm:** https://www.npmjs.com/package/reaktiform
- **GitHub:** https://github.com/suryabaskaran15/reaktiform
- **Issues:** https://github.com/suryabaskaran15/reaktiform/issues
