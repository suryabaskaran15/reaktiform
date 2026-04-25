# reaktiform

**High-performance inline-editable data grid + side panel form for React.**

[![npm](https://img.shields.io/npm/v/reaktiform)](https://www.npmjs.com/package/reaktiform)
[![bundle size](https://img.shields.io/bundlephobia/minzip/reaktiform)](https://bundlephobia.com/package/reaktiform)
[![license](https://img.shields.io/npm/l/reaktiform)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-blue)](https://www.typescriptlang.org)

---

## What is reaktiform?

reaktiform combines a **data grid** and a **detail panel form** into one component. Click any cell to edit inline. Press Space to open the side panel with a full form view. All edits are tracked with undo/redo, validated before saving, and committed to your API.

**Core design principle:** The grid store is the source of truth. Your API callback fires and the grid keeps the edited values — no refetch, no race conditions.

---

## Features

| Category                   | What you get                                                                  |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Editing**                | Click-to-edit, Tab/Enter confirm, Esc cancel, full keyboard navigation        |
| **Select fields**          | Static, async search, creatable, async+creatable, multi-select                |
| **Badge colors**           | 3-format option colors — named tokens, CSS strings, custom objects            |
| **Data loading**           | Client-side or server-side — infinite scroll, sort, filter, global search     |
| **Performance**            | TanStack Virtual — 100k+ rows with zero lag                                   |
| **Validation**             | Zod-powered per-field and cross-field rules, inline error display             |
| **Dynamic constraints**    | `min`/`max`/`minDate`/`maxDate` accept `(row) => value` for cross-field rules |
| **readOnly prop**          | `boolean` or `(row) => boolean` — lock cells conditionally per row            |
| **Undo / Redo**            | Full history stack — Ctrl+Z / Ctrl+Y                                          |
| **Side panel**             | Detail form auto-generated from your column definitions                       |
| **Computed columns**       | Formula engine with dependency tracking                                       |
| **Conditional formatting** | Rule-based row highlighting                                                   |
| **Column management**      | Resize, reorder, pin, show/hide                                               |
| **Export**                 | CSV and Excel — async select labels correctly resolved                        |
| **Save state**             | Per-row `_saving` flag, spinner + disabled buttons in-flight                  |
| **Persistence**            | Column widths, filters, pins saved to localStorage                            |
| **CSS isolation**          | Works alongside Tailwind, Bootstrap, MUI — zero conflict                      |
| **Dark mode**              | Automatic via `.dark` class                                                   |
| **TypeScript**             | Full generics — `ColumnDef<MyRow>`, `Reaktiform<MyRow>`                       |

---

## Install

```bash
npm install reaktiform
# or
pnpm add reaktiform
```

**Peer dependencies:** React 18+

```bash
npm install react react-dom
```

No Tailwind required. No global CSS conflicts. All styles are scoped inside `[data-reaktiform]`.

---

## Quick Start

```tsx
import { Reaktiform } from "reaktiform";
import type { ColumnDef } from "reaktiform";
import "reaktiform/styles"; // ← import once in your app root

type Project = {
  id: string;
  name: string;
  status: string;
  budget: number;
  dueDate: string;
};

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
    min: 0,
  },
  {
    key: "dueDate",
    label: "Due Date",
    type: "date",
  },
];

export function ProjectGrid() {
  const [data, setData] = useState<Project[]>([]);

  return (
    <Reaktiform<Project>
      columns={columns}
      data={data}
      rowIdKey="id"
      onCreate={async (row) => {
        const saved = await api.post("/projects", row);
        return saved; // returned value merges back — captures server-generated id
      }}
      onUpdate={async (row) => {
        await api.patch(`/projects/${row.id}`, row);
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

## CSS Import

Import the stylesheet **once** in your app root:

```tsx
// main.tsx / _app.tsx / root.tsx
import "reaktiform/styles";
```

**Why manual import?** Component libraries must not inject CSS automatically — different frameworks (Next.js, Remix, Vite) load styles at different lifecycle points. One import gives you full control over load order. This is the same pattern used by Ant Design, Radix UI, and React Toastify.

**TypeScript error?** If you see `Cannot find module 'reaktiform/styles'`, make sure you are on v1.2.0+ which includes the `dist-types/reaktiform.css.d.ts` declaration file.

---

## Server-Side Mode

For large datasets — server-side sort, filter, search, and infinite scroll.

```tsx
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";

const PAGE_SIZE = 30;

function ServerGrid() {
  const [params, setParams] = useState({});

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["projects", params],
    queryFn: ({ pageParam = 0 }) => fetchPage(pageParam, PAGE_SIZE, params),
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.hasMore ? all.reduce((n, p) => n + p.rows.length, 0) : undefined,
  });

  // ⚠️ Always memoize — prevents data-sync effect from overwriting in-progress edits
  const rows = useMemo(() => data?.pages.flatMap((p) => p.rows) ?? [], [data]);
  const total = data?.pages[0]?.total ?? rows.length;

  const update = useMutation({
    mutationFn: (row: Project) =>
      api.put(`/projects/${row.id}`, toPayload(row)),
    // ✅ No onSuccess invalidation — store already has the correct values
  });

  return (
    <Reaktiform<Project>
      columns={columns}
      data={rows}
      rowIdKey="id"
      sortingMode="server"
      totalRows={total}
      pageSize={PAGE_SIZE}
      fetchThreshold={8}
      isLoading={isLoading}
      isFetching={isFetching && !isFetchingNextPage}
      isFetchingMore={isFetchingNextPage}
      onSortChange={({ sortBy, sortDir }) =>
        setParams((p) => ({ ...p, sortBy, sortDir }))
      }
      onFilterChange={(filters) => setParams((p) => ({ ...p, filters }))}
      onSearchChange={(search) => setParams((p) => ({ ...p, search }))}
      onFetchMore={async () => {
        await fetchNextPage();
      }}
      onRefresh={async () => {
        await refetch();
      }}
      onUpdate={async (row) => update.mutateAsync(row)}
    />
  );
}
```

---

## Column Types

| Type          | Description                              | Stored as                                       | Edit widget          |
| ------------- | ---------------------------------------- | ----------------------------------------------- | -------------------- |
| `text`        | Plain string                             | `string`                                        | Text input           |
| `number`      | Numeric — prefix/suffix/decimals         | `number \| null`                                | Number input         |
| `currency`    | Formatted currency                       | `number \| null`                                | Number input         |
| `percentage`  | Number with % bar                        | `number \| null`                                | Number input         |
| `select`      | Single dropdown                          | `string` (static) or `{value,label}` (async)    | React Select         |
| `multiselect` | Multi-select                             | `string[]` (static) or `SelectOption[]` (async) | React Select isMulti |
| `date`        | ISO date — picker auto-closes after pick | `"YYYY-MM-DD"`                                  | Native date picker   |
| `time`        | 24-hour time — displays as AM/PM         | `"HH:MM"`                                       | Native time picker   |
| `checkbox`    | Boolean toggle                           | `boolean`                                       | Checkbox             |
| `email`       | Email + mailto link                      | `string`                                        | Text input           |
| `url`         | URL + hyperlink                          | `string`                                        | Text input           |
| `rating`      | Star rating                              | `number \| null`                                | Click stars          |
| `badge`       | Read-only colored label                  | `string`                                        | —                    |
| `progress`    | 0–100 progress bar                       | `number`                                        | —                    |

---

## Select Fields — Complete Guide

### 1. Static Select

Options defined upfront. No API calls.

```tsx
{
  key:   'status',
  label: 'Status',
  type:  'select',
  options: [
    { value: 'PENDING',   label: 'Pending',   color: 'warning' },
    { value: 'APPROVED',  label: 'Approved',  color: 'success' },
    { value: 'REJECTED',  label: 'Rejected',  color: 'error'   },
  ],
  required: true,
}
```

Stored value: plain string — `"PENDING"`.

### 2. Async Select (Server Search)

Options loaded from an API. Results are cached at module level — first open fetches, every re-open after that is instant.

```tsx
{
  key:         'category',
  label:       'Category',
  type:        'select',
  required:    true,
  clearable:   true,
  loadOptions: async (input) => {
    const res = await fetch(`/api/categories?q=${input}`)
    return (await res.json()).map(c => ({ value: c.id, label: c.name }))
  },
}
```

Stored value: `{ value: string, label: string }` — label stored alongside id for immediate display without a re-fetch.

In your `toPayload` / save function:

```ts
category: row.category?.value ? { id: row.category.value } : null;
```

### 3. Creatable Select

Users can create new options by typing and pressing Enter.

```tsx
{
  key:   'tag',
  label: 'Tag',
  type:  'select',
  onCreateOption: async (name) => {
    const created = await api.post('/tags', { name })
    return { value: created.id, label: created.name }
  },
  options: existingTags,
}
```

### 4. Async + Creatable Select

```tsx
{
  key:         'supplier',
  label:       'Supplier',
  type:        'select',
  clearable:   true,
  loadOptions: async (input) => {
    return (await api.get(`/suppliers?q=${input}`)).map(s => ({
      value: s.id, label: s.name,
    }))
  },
  onCreateOption: async (name) => {
    const s = await api.post('/suppliers', { name })
    return { value: s.id, label: s.name }
  },
}
```

### 5. Static Multi-Select

```tsx
{
  key:     'tags',
  label:   'Tags',
  type:    'multiselect',
  options: [
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend',  label: 'Backend'  },
  ],
  clearable: true,
}
```

Stored value: `string[]`

### 6. Async Multi-Select

```tsx
{
  key:         'assignees',
  label:       'Assignees',
  type:        'multiselect',
  clearable:   true,
  loadOptions: async (input) => {
    return (await api.get(`/users?q=${input}`)).map(u => ({
      value: u.id, label: u.name,
    }))
  },
}
```

Stored value: `SelectOption[]` — array of `{ value, label }` objects.

In your `toPayload`:

```ts
assignees: row.assignees?.map((a) => ({ id: a.value })) ?? [];
```

### `clearable` — Allow Removing a Selection

Set `clearable: true` on any select column to show an ✕ button. Works on all 4 variants.

```tsx
{ key: 'category', type: 'select', clearable: true, loadOptions: searchCategories }
```

### Select — Data Flow Summary

| `loadOptions` | `onCreateOption` | Variant            | Stored value                   |
| ------------- | ---------------- | ------------------ | ------------------------------ |
| ✗             | ✗                | Static select      | `"PENDING"`                    |
| ✓             | ✗                | Async select       | `{value:"uuid", label:"Name"}` |
| ✗             | ✓                | Creatable select   | `"new-tag"`                    |
| ✓             | ✓                | Async+creatable    | `{value:"uuid", label:"Name"}` |
| ✗             | ✗                | Static multiselect | `["a","b"]`                    |
| ✓             | ✓                | Async multiselect  | `[{value,label}, ...]`         |

---

## Time Fields

Store and display time values as `"HH:MM"` (24-hour ISO format).

```tsx
{
  key:      'meetingTime',
  label:    'Meeting Time',
  type:     'time',
  width:    130,
  required: true,
}
```

- **Stored as:** `"HH:MM"` — e.g. `"09:00"`, `"14:30"`, `"23:45"`
- **Displayed as:** `"09:00 AM"`, `"02:30 PM"` in read mode
- **Picker:** Native browser time input — opens on click, auto-closes after selection
- **Keyboard:** Tab/Enter confirm, Esc cancel

---

## Dynamic Constraints — Cross-Field Rules

`min`, `max`, `minDate`, and `maxDate` accept either a **static value** or a **function** receiving the current row. This enables cross-field validation — for example, ensuring an approval date always comes after the request date.

```tsx
const columns: ColumnDef<ProcurementRow>[] = [
  {
    key: "requestDate",
    label: "Request Date",
    type: "date",
  },
  {
    key: "approvedDate",
    label: "Approved Date",
    type: "date",
    // ✅ Must be on or after requestDate
    minDate: (row) => row.requestDate as string | undefined,
    // ✅ Cannot exceed project end
    maxDate: (row) => row.projectEnd as string | undefined,
  },
  {
    key: "poValue",
    label: "PO Value",
    type: "currency",
    min: 0,
    // ✅ Cannot exceed approved budget
    max: (row) => row.budgetCost as number | undefined,
  },
  {
    key: "leadTime",
    label: "Lead Time (days)",
    type: "number",
    min: 0,
    // ✅ Cannot exceed contract duration
    max: (row) => row.contractDays as number | undefined,
  },
];
```

**How it works:**

The function receives the **merged row** — base server values overlaid with any unsaved draft edits. When a user changes `requestDate` to April 24, the `approvedDate` picker immediately updates its minimum to April 24 — no save required.

Static constraints go into the Zod schema as usual. Dynamic constraints are evaluated at validation time with the actual current row values, so error messages include the resolved value (e.g. `"Approved Date must be on or after 2026-04-24"`).

---

## readOnly — Conditional Cell Locking

Lock individual columns from editing, statically or based on row data.

```tsx
// Always locked — useful for computed or server-managed fields
{ key: 'id',           type: 'text', readOnly: true }
{ key: 'createdAt',    type: 'date', readOnly: true }

// Locked when the row is in a terminal state
{
  key:      'contractValue',
  type:     'currency',
  readOnly: (row) => row.status === 'CLOSED',
}

// Only editable when a condition in another field is met
{
  key:      'injuryDetails',
  type:     'text',
  readOnly: (row) => row.lostTimeInjury !== 'YES',
}

// Locked after an approval action
{
  key:      'approvedDate',
  type:     'date',
  readOnly: (row) => !!(row as MyRow).approvedBy,
}
```

**Grid behaviour:**

- Cell click does nothing — edit mode never activates
- Cursor stays `default` (no text cursor hint)
- Cell is dimmed to 72% opacity as a clear visual cue

**Side panel behaviour:**

- The field renders as a static display box — grey background, not interactive
- Applies to all field types: text, number, date, time, select, checkbox, etc.

**Important — in-session reactivity:** The function receives the **merged row** (base + unsaved draft). If a user changes `lostTimeInjury` to `"YES"` in the same editing session, `injuryDetails` unlocks immediately without requiring a save first.

---

## Option Badge Colors — Three Formats

`SelectOption.color` controls the badge appearance everywhere — in dropdown options, grid cell read mode, multiselect pills, and badge columns.

### 1. Named semantic tokens (built-in palette)

```ts
options: [
  { value: "PENDING", label: "Pending", color: "warning" },
  { value: "APPROVED", label: "Approved", color: "success" },
  { value: "REJECTED", label: "Rejected", color: "error" },
  { value: "REVIEW", label: "In Review", color: "info" },
  { value: "ARCHIVED", label: "Archived", color: "default" },
  { value: "PRIORITY", label: "Priority", color: "purple" },
];
```

Available tokens: `'default'` | `'success'` | `'warning'` | `'error'` | `'info'` | `'purple'`

### 2. Any CSS color string (auto-derived styling)

```ts
options: [
  { value: "CRITICAL", label: "Critical", color: "#E53E3E" },
  { value: "ACTIVE", label: "Active", color: "rgb(22,163,74)" },
  { value: "DRAFT", label: "Draft", color: "hsl(217,91%,60%)" },
  { value: "SPECIAL", label: "Special", color: "tomato" },
];
```

Background, border, and text colors are automatically derived from the color value. Hex colors (`#RRGGBB`) produce the most accurate results.

### 3. Full custom object — complete control

```ts
options: [
  {
    value: "BLOCKED",
    label: "Blocked",
    color: {
      bg: "#FEE2E2", // badge background
      text: "#991B1B", // text color
      dot: "#DC2626", // indicator dot
      border: "#FECACA", // border
    },
  },
  // Partial — omit any field to auto-derive from bg
  {
    value: "GOLD",
    label: "Gold Member",
    color: { bg: "#FEF3C7", text: "#92400E" },
  },
];
```

All four fields are optional. Missing fields are auto-derived from `bg`.

**Note:** Badge colors use inline styles only — they work identically inside the grid, inside React Select's portal (`document.body`), and in any consumer app.

---

## All Column Definition Props

```ts
type ColumnDef<TData = Record<string, unknown>> = {
  // ── Required ──────────────────────────────────────────────
  key: keyof TData & string; // maps to your data field
  label: string; // column header text
  type: ColumnType; // see Column Types table above

  // ── Layout ────────────────────────────────────────────────
  width?: number; // initial column width (px). Default: 150
  minWidth?: number; // minimum resize width. Default: 60
  maxWidth?: number; // maximum resize width. Default: 600
  hidden?: boolean; // start hidden (user can show via column panel)
  pinned?: boolean; // pin to left — stays visible when scrolling
  align?: "left" | "center" | "right";

  // ── Behaviour ─────────────────────────────────────────────
  sortable?: boolean; // default: true
  filterable?: boolean; // default: true
  groupable?: boolean; // default: false
  resizable?: boolean; // default: true
  copyable?: boolean; // click cell to copy value to clipboard

  /**
   * Lock column from editing. Boolean or per-row function.
   * Function receives merged row (base + draft) for in-session reactivity.
   * @example
   * readOnly: true
   * readOnly: (row) => row.status === 'CLOSED'
   * readOnly: (row) => row.lostTimeInjury !== 'YES'
   */
  readOnly?: boolean | ((row: TData) => boolean);

  // ── Validation ────────────────────────────────────────────
  required?: boolean;

  /**
   * Minimum value for number/currency/percentage/rating columns.
   * Static number or a function receiving the merged row.
   * @example
   * min: 0
   * min: (row) => row.allocatedBudget
   */
  min?: number | ((row: TData) => number | undefined);

  /**
   * Maximum value for number/currency/percentage/rating columns.
   * @example
   * max: 1_000_000
   * max: (row) => row.budgetCeiling
   */
  max?: number | ((row: TData) => number | undefined);

  minLength?: number; // text: minimum character count
  maxLength?: number; // text: maximum character count
  pattern?: RegExp; // text: regex validation
  patternMessage?: string; // custom error message for pattern
  validate?: (value: unknown, row: TData) => string | undefined;

  // ── Display ───────────────────────────────────────────────
  format?: (value: unknown, row: TData) => string;
  cellClassName?: (value: unknown, row: TData) => string | undefined;
  cellStyle?: (value: unknown, row: TData) => React.CSSProperties | undefined;
  headerTooltip?: string;
  renderCell?: (value: unknown, row: TData) => React.ReactNode;
  renderEditCell?: (
    value: unknown,
    row: TData,
    onChange: (v: unknown) => void,
    onCancel: () => void,
  ) => React.ReactNode;

  // ── Select / Multiselect ──────────────────────────────────
  options?: SelectOption[];
  searchable?: boolean; // show search box in dropdown
  clearable?: boolean; // show ✕ to clear selection (default: false)
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;

  // ── Number / Currency / Percentage ────────────────────────
  decimals?: number;
  prefix?: string; // shown before value: 'RM ', '$ '
  suffix?: string; // shown after value:  ' days', ' kg'
  currency?: string; // ISO 4217: 'USD', 'MYR', 'EUR'
  locale?: string; // BCP 47: 'en-US', 'ms-MY'
  step?: number; // input step size
  aggregation?: "sum" | "avg" | "min" | "max" | "count";

  // ── Rating ────────────────────────────────────────────────
  ratingMax?: number; // max stars. Default: 5

  // ── Email / URL ───────────────────────────────────────────
  openInNewTab?: boolean; // open link in new tab. Default: true

  // ── Date ──────────────────────────────────────────────────
  /**
   * Minimum selectable date. Static ISO string or a function for
   * cross-field constraints. Function receives merged row (base + draft).
   * @example
   * minDate: '2024-01-01'
   * minDate: (row) => row.requestDate
   */
  minDate?: string | ((row: TData) => string | undefined);

  /**
   * Maximum selectable date. Static ISO string or a function.
   * @example
   * maxDate: '2030-12-31'
   * maxDate: (row) => row.projectEndDate
   */
  maxDate?: string | ((row: TData) => string | undefined);

  dateFormat?: string; // display format

  // ── Text ──────────────────────────────────────────────────
  multiline?: boolean; // use textarea instead of input
  rows?: number; // textarea row count
  showCharCount?: boolean; // show character count indicator

  // ── Computed / Formula ────────────────────────────────────
  computed?: boolean;
  formula?: (row: TData) => unknown;
  dependsOn?: (keyof TData)[];
  editableWhenComputed?: boolean;
  saveComputed?: boolean;
  aggregateComputed?: boolean;

  // ── Value Transform (advanced) ────────────────────────────
  valueTransform?: {
    read?: (raw: unknown) => unknown; // transform before display
    write?: (val: unknown) => unknown; // transform before API call
  };
};
```

---

## All Grid Props

### Required

| Prop      | Type                 | Description        |
| --------- | -------------------- | ------------------ |
| `columns` | `ColumnDef<TData>[]` | Column definitions |
| `data`    | `TData[]`            | Row data array     |

### CRUD Callbacks

| Prop            | Type                                                     | Description                                     |
| --------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `onCreate`      | `(row: TData) => Promise<TData \| void>`                 | New row — return saved row to capture server id |
| `onUpdate`      | `(row: TData) => Promise<TData \| void>`                 | Existing row update                             |
| `onSave`        | `(row: TData, isNew: boolean) => Promise<TData \| void>` | Single callback for both                        |
| `onDelete`      | `(id: string) => Promise<void>`                          | Single row delete                               |
| `onBulkDelete`  | `(ids: string[]) => Promise<void>`                       | Multiple rows in one call                       |
| `onBulkSave`    | `(rows: TData[]) => Promise<TData[] \| void>`            | Save All in one call                            |
| `onSaveSuccess` | `(row: TData, isNew: boolean) => void`                   | For toast notifications                         |
| `onSaveError`   | `(err: Error, row: TData, isNew: boolean) => void`       | For error toasts                                |

### Server-Side Mode

| Prop             | Type                            | Default    | Description                          |
| ---------------- | ------------------------------- | ---------- | ------------------------------------ |
| `sortingMode`    | `'client' \| 'server'`          | `'client'` | Server mode disables built-in sort   |
| `totalRows`      | `number`                        | —          | Total record count for scroll sizing |
| `pageSize`       | `number`                        | `50`       | Records per page                     |
| `fetchThreshold` | `number`                        | `10`       | Rows from end before pre-fetch       |
| `onSortChange`   | `(p: SortChangeParams) => void` | —          | User clicked a column header         |
| `onFilterChange` | `(f: ActiveFilters) => void`    | —          | Column filter changed                |
| `onSearchChange` | `(q: string) => void`           | —          | Global search input                  |
| `onFetchMore`    | `() => Promise<void>`           | —          | User nearing end of list             |
| `onRefresh`      | `() => Promise<void>`           | —          | Sync button pressed                  |

### Loading States

| Prop             | Type      | Description                                |
| ---------------- | --------- | ------------------------------------------ |
| `isLoading`      | `boolean` | Show full skeleton loader                  |
| `isFetching`     | `boolean` | Show top progress bar (background refresh) |
| `isFetchingMore` | `boolean` | Show "Loading more…" at bottom             |

### Row Behaviour

| Prop                | Type                                         | Default   | Description                  |
| ------------------- | -------------------------------------------- | --------- | ---------------------------- |
| `rowIdKey`          | `keyof TData`                                | `'id'`    | Unique identifier field      |
| `rowHeight`         | `number`                                     | `46`      | Row height in px             |
| `rowClassName`      | `(row: TData) => string \| undefined`        | —         | Dynamic CSS class per row    |
| `rowStyle`          | `(row: TData) => CSSProperties \| undefined` | —         | Dynamic inline style per row |
| `isRowDisabled`     | `(row: TData) => boolean`                    | —         | Grey out + prevent editing   |
| `selectionMode`     | `'multi' \| 'single' \| 'none'`              | `'multi'` | Checkbox behaviour           |
| `onRowClick`        | `(row: TData) => void`                       | —         | Row click handler            |
| `onSelectionChange` | `(ids: string[], rows: TData[]) => void`     | —         | Selection changed            |

### Layout

| Prop           | Type               | Default                 | Description                       |
| -------------- | ------------------ | ----------------------- | --------------------------------- |
| `maxHeight`    | `string \| number` | `'calc(100vh - 300px)'` | Scroll area max height            |
| `minHeight`    | `string \| number` | `380`                   | Scroll area min height            |
| `emptyState`   | `ReactNode`        | built-in                | Custom empty state component      |
| `toolbarLeft`  | `ReactNode`        | —                       | Slot after search box             |
| `toolbarRight` | `ReactNode`        | —                       | Slot before "+ New Record" button |

### Feature Flags

All features are enabled by default. Disable selectively:

```tsx
<Reaktiform
  features={{
    undoRedo: true,
    sidePanel: true,
    export: true,
    columnHide: true,
    columnPin: true,
    columnResize: true,
    columnReorder: true,
    conditionalFormat: true,
    groupBy: true,
    showRowNumbers: true,
    showSelectColumn: true,
    showActionsColumn: true,
    newRecord: true,
    search: true,
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
    canEditRow: (row) => row.status !== "LOCKED",
    canDeleteRow: (row) => row.createdBy === userId,
    canDuplicateRow: true,
    canEditCol: (colKey) => colKey !== "id",
  }}
/>
```

### Persistence

```tsx
<Reaktiform storageKey="my-grid-v1" />
// Change the key when your column schema changes to reset saved state
```

---

## Validation

Validation runs automatically from `ColumnDef`. For custom rules, use `validate`:

```tsx
// Built-in
{ key: 'email', type: 'email', required: true, maxLength: 200 }

// Number zero is always valid — required only rejects null/undefined/empty
{ key: 'quantity', type: 'number', required: true, min: 0 }

// Cross-field custom rule
{
  key:      'endDate',
  type:     'date',
  validate: (value, row) => {
    if (value && row.startDate && value < row.startDate) {
      return 'End date must be after start date'
    }
  }
}
```

**Note on zero:** Number fields with `required: true` correctly accept `0` as a valid value. The required check tests `null | undefined | ''`, not falsy values.

---

## Save Button State

While an API call is in-flight, reaktiform automatically:

- Disables **Save / Save All / Discard** buttons and shows a spinner
- Sets `row._saving = true` on the saving row — useful in headless mode
- Prevents duplicate submissions on double-click
- Auto-opens the error popover on the failed row when an API call fails

No extra props needed — this is built in.

---

## Computed Columns

```tsx
{
  key:       'margin',
  label:     'Margin',
  type:      'percentage',
  computed:  true,
  dependsOn: ['revenue', 'cost'],
  formula:   (row) =>
    row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : 0,
}
```

---

## Custom Cell Renderers

```tsx
// Custom read display
{
  key:  'assignee',
  type: 'text',
  renderCell: (value, row) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img src={row.avatarUrl} style={{ width: 20, borderRadius: '50%' }} />
      <span>{String(value)}</span>
    </div>
  ),
}

// Custom edit widget
{
  key:  'color',
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

Use the state management with your own UI:

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
        <div key={row._id}>
          <span>{row.name as string}</span>
          {grid.isDirty(row) && (
            <button
              disabled={!!row._saving}
              onClick={() => grid.saveRow(row._id)}
            >
              {row._saving ? "Saving…" : "Save"}
            </button>
          )}
          {row._saveError && <span className="error">{row._saveError}</span>}
        </div>
      ))}
    </div>
  );
}
```

**Available from `useReaktiform`:**

| Property                              | Description                         |
| ------------------------------------- | ----------------------------------- |
| `grid.rows`                           | All rows including unsaved          |
| `grid.isDirty(row)`                   | Has unsaved changes                 |
| `grid.getErrors(row)`                 | `Record<fieldKey, errorMessage>`    |
| `grid.markDirty(rowId, field, value)` | Update a field                      |
| `grid.saveRow(rowId)`                 | Save one row                        |
| `grid.discardRow(rowId)`              | Discard changes                     |
| `grid.saveAll()`                      | Save all dirty rows                 |
| `grid.discardAll()`                   | Discard all changes                 |
| `grid.addRow(defaults?)`              | Add a new row                       |
| `grid.deleteRow(rowId)`               | Delete a row                        |
| `grid.dirtyCount`                     | Number of rows with unsaved changes |
| `grid.savingCount`                    | Number of rows currently in-flight  |
| `row._saving`                         | `true` while API call is in-flight  |
| `row._saveError`                      | Last save error message             |

---

## Standalone Cell Components

Use individual cells inside your own forms:

```tsx
import { SelectCellEdit, DateCellEdit } from "reaktiform/cells";
import "reaktiform/styles";

function MyForm() {
  const [status, setStatus] = useState("");

  return (
    <SelectCellEdit
      value={status}
      options={[
        { value: "open", label: "Open", color: "success" },
        { value: "closed", label: "Closed", color: "default" },
      ]}
      isClearable
      onCommit={(value) => setStatus(value)}
      onCancel={() => {}}
    />
  );
}
```

---

## Export

Built-in CSV and Excel export. Async select values export as labels (not raw UUIDs).

```tsx
// Built-in buttons in toolbar
<Reaktiform features={{ export: true }} />

// Custom server-side export
<Reaktiform
  onExport={async (format) => {
    const url = await api.post('/reports/export', { format })
    window.open(url)
  }}
/>
```

---

## Theming

All colors are CSS custom properties scoped to `[data-reaktiform]`:

```css
.my-app [data-reaktiform] {
  --rf-accent: #7c3aed; /* brand color — buttons, focus rings */
  --rf-surface: #fafafa; /* card / panel background */
  --rf-bg: #f5f5f5; /* cell background */
  --rf-border: #e5e7eb; /* all borders */
  --rf-text-1: #111827; /* primary text */
  --rf-text-2: #6b7280; /* secondary text */
  --rf-text-3: #9ca3af; /* placeholder / muted */
  --rf-ok: #16a34a; /* success */
  --rf-warn: #d97706; /* warning */
  --rf-err: #dc2626; /* error */
  --rf-radius-md: 8px;
  --rf-radius-lg: 12px;
}
```

**Dark mode** — add `dark` class to `<html>` or any ancestor:

```html
<html class="dark">
  <!-- reaktiform detects .dark automatically -->
</html>
```

---

## CSS Isolation

reaktiform uses `rf-*` prefixed utility classes and scopes all CSS under `[data-reaktiform]`. It is fully isolated from — and compatible with — any consumer CSS framework:

| Consumer framework                | Status              |
| --------------------------------- | ------------------- |
| Tailwind CSS (any version/config) | ✅ No conflict      |
| Bootstrap                         | ✅ No conflict      |
| MUI / Emotion                     | ✅ No conflict      |
| Ant Design                        | ✅ No conflict      |
| Vanilla CSS                       | ✅ No conflict      |
| No framework                      | ✅ Works standalone |

React Select dropdown menus portal to `document.body`. Badge colors inside dropdowns use inline styles to ensure they work correctly outside the `[data-reaktiform]` scope.

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

---

## Common Patterns

### toPayload — Strip Internal Fields

reaktiform adds `_*` internal fields to every row. Strip them before your API:

```ts
function toPayload(row: MyRow): ApiPayload {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    // Async select — send id reference only
    category: row.category?.value ? { id: row.category.value } : null,
    // Async multiselect — send array of id references
    assignees: row.assignees?.map((a) => ({ id: a.value })) ?? [],
    // _id, _draft, _saving, _errors etc. are excluded by listing fields explicitly
  };
}
```

### mapRow — Server Data to Grid Format

```ts
function mapRow(raw: ApiRow): MyRow {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    // Async select — store { value, label } so label shows without a re-fetch
    category: raw.category?.id
      ? { value: raw.category.id, label: raw.category.name }
      : undefined,
    // Async multiselect — store SelectOption[]
    assignees:
      raw.assignees?.map((u) => ({ value: u.id, label: u.name })) ?? [],
  };
}
```

### React Query — No Refetch After Mutation

```tsx
const updateMutation = useMutation({
  mutationFn: (row: MyRow) => api.put(`/items/${row.id}`, toPayload(row)),
  // ✅ Correct — store already has the right values
  // ❌ Don't do: onSuccess: () => queryClient.invalidateQueries(...)
  //    Refetching overwrites the store's committed values mid-render
});
```

### Invalidating the Async Select Cache

When you create a new option outside the grid (e.g. a separate form), call `invalidateLoadOptionsCache` to ensure the new item appears in the dropdown next time it opens:

```ts
import { invalidateLoadOptionsCache } from "reaktiform";

// After creating a category externally:
const created = await api.post("/categories", { name });
invalidateLoadOptionsCache(searchCategories); // pass the same function reference
```

---

## TypeScript Reference

```ts
import type {
  ColumnDef, // column definition — generic over your row type
  SelectOption, // { value, label, color?, disabled? }
  ColumnType, // 'text'|'number'|'select'|'date'|'time'|...
  ActiveFilters, // Record<string, FilterValue>
  FilterValue, // per-column filter value shape
  SortChangeParams, // { sortBy: string, sortDir: 'asc'|'desc' }
  GridFeatures, // all feature flag keys
  GridPermissions, // all permission keys
  Row, // TData & RowMeta (_id, _draft, _saving, _errors, _saveError)
  BadgeColor, // named | CSS string | { bg?, text?, dot?, border? }
  AggregationMode, // 'sum'|'avg'|'min'|'max'|'count'|'none'
} from "reaktiform";

// Utility functions
import {
  cachedLoadOptions, // wrap loadOptions fn for instant re-opens
  invalidateLoadOptionsCache, // call after external create to refresh options
} from "reaktiform";
```

---

## Changelog

### v1.2.1

**New Features**

- **`type: 'time'`** — stores `"HH:MM"`, displays as `"hh:MM AM/PM"`. Native time picker auto-closes after selection.
- **`readOnly` column prop** — `boolean | ((row) => boolean)`. Locks cells from editing, statically or per-row. Function receives merged row (base + draft) for in-session reactivity.
- **Dynamic `min` / `max` / `minDate` / `maxDate`** — all four constraint props now accept `(row) => value` functions for cross-field validation (e.g. approved date must be after request date). `resolveConstraint()` utility exported from `reaktiform/utils`.
- **Option badge colors — 3 formats** — `SelectOption.color` now accepts named tokens (`'success'`), any CSS color string (`'#E53E3E'`), or a full custom object (`{ bg, text, dot, border }`).

**Bug Fixes**

- **Date picker auto-closes** — native calendar popup now closes immediately after date selection. Previously required a manual click outside.
- **Select dropdown colors in production** — option badges were unstyled in production builds. Root cause: `Badge` used scoped CSS classes that don't apply inside React Select's `document.body` portal. Rewritten with 100% inline styles.
- **Cross-field constraint stale values** — `minDate: (row) => row.rfqDate` previously read the server value, ignoring unsaved edits in the same session. Now reads the merged row.
- **Zero validation error** — number fields with `required: true` incorrectly rejected `0` as empty. Fixed with explicit `null` check instead of falsy check in Zod schema.
- **CSS isolation** — all component class names now use `rf-*` prefix. Isolation reset block prevents Tailwind preflight from affecting component internals.

### v1.2.0

- **`clearable` column prop** — ✕ clear button on any select variant
- **Async select display** — stored `{value,label}` — labels show without extra API calls
- **Module-level option cache** — re-opening async selects is instant after first load
- **Save state** — `_saving` flag, spinner + disabled buttons while API call in-flight
- **API error in popover** — save errors shown in the row error popover, auto-opens on failure
- **Export fix** — CSV/Excel exports labels for async select values (not raw UUIDs)
- **Validation fix** — Zod no longer throws "Expected string, received object" for async selects
- **CSS type declarations** — `import 'reaktiform/styles'` no longer causes TS2307 error

### v1.1.0

- Server-side sort, filter, search, infinite scroll
- Conditional formatting rule builder
- Column visibility panel with drag-to-reorder
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
