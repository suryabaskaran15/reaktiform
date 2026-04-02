# reaktiform

**Inline-editable data grid with a built-in detail panel for React.**

Sort, filter, group, edit cells inline, validate, save to your API — all in one component.

```tsx
import { Reaktiform } from "reaktiform";
import "reaktiform/styles";

<Reaktiform
  columns={columns}
  data={rows}
  rowIdKey="id"
  onUpdate={async (row) => await api.patch("/risks", row)}
  storageKey="my-grid-v1"
/>;
```

---

## Install

```bash
npm install reaktiform
# or
pnpm add reaktiform
```

### Peer dependencies

```bash
npm install react react-dom
```

Tailwind CSS is optional — reaktiform ships its own CSS variables. Import the stylesheet:

```ts
import "reaktiform/styles";
```

---

## Quick start

```tsx
import { Reaktiform } from "reaktiform";
import type { ColumnDef } from "reaktiform";
import "reaktiform/styles";

type Project = {
  id: string;
  name: string;
  status: string;
  budget: number;
};

const columns: ColumnDef<Project>[] = [
  { key: "name", label: "Name", type: "text", required: true },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Active", value: "active", color: "success" },
      { label: "On Hold", value: "on_hold", color: "warning" },
      { label: "Archived", value: "archived", color: "default" },
    ],
  },
  { key: "budget", label: "Budget", type: "number", prefix: "$" },
];

export function ProjectGrid() {
  const [data, setData] = useState<Project[]>([]);

  return (
    <Reaktiform<Project>
      columns={columns}
      data={data}
      rowIdKey="id"
      onUpdate={async (row) => {
        const saved = await api.patch(`/projects/${row.id}`, row);
        return saved;
      }}
      onCreate={async (row) => {
        const saved = await api.post("/projects", row);
        return saved;
      }}
      onDelete={async (id) => {
        await api.delete(`/projects/${id}`);
        setData((prev) => prev.filter((r) => r.id !== id));
      }}
      storageKey="projects-v1"
    />
  );
}
```

---

## Column types

| `type`        | Input        | Notes                                                          |
| ------------- | ------------ | -------------------------------------------------------------- |
| `text`        | Text input   | `minLength`, `maxLength`, `pattern`, `multiline`               |
| `number`      | Number input | `min`, `max`, `suffix`, `prefix`, `decimals`                   |
| `select`      | Dropdown     | `options`, `loadOptions` (async), `onCreateOption` (creatable) |
| `multiselect` | Multi-select | Same as select, multiple values                                |
| `date`        | Date picker  | `minDate`, `maxDate`                                           |
| `checkbox`    | Toggle       | —                                                              |

### Select variants

```ts
// 1. Static — options array
{ key: 'status', type: 'select', options: statusOptions }

// 2. Async — search server as user types
{
  key: 'owner', type: 'select',
  options: initialOptions,           // shown before user types
  loadOptions: async (q) => {        // called on each keystroke
    return await api.searchUsers(q)
  }
}

// 3. Creatable — let users type new options
{
  key: 'tags', type: 'multiselect',
  options: existingTags,
  onCreateOption: async (label) => {
    const tag = await api.createTag(label)
    return { label: tag.name, value: tag.id }
  }
}

// 4. Async + Creatable — both at once
{
  key: 'tags', type: 'multiselect',
  options: existingTags,
  loadOptions: searchTags,
  onCreateOption: createTag,
}
```

---

## Validation

```ts
// Built-in validation — declared in column def
{ key: 'name', type: 'text', required: true, minLength: 3, maxLength: 100 }
{ key: 'budget', type: 'number', min: 0, max: 1_000_000 }
{ key: 'code', type: 'text', pattern: /^[A-Z]{3}-\d+$/, patternMessage: 'Format: ABC-001' }

// Custom validation — runs after built-in rules
{
  key: 'completionPct', type: 'number',
  validate: (value, row) => {
    if (row.status === 'done' && Number(value) < 100) {
      return 'Must be 100% when status is Done'
    }
  }
}
```

---

## Server-side sorting & filtering

```tsx
const [params, setParams] = useState({})

// Re-fetch when params change
useEffect(() => {
  api.getProjects(params).then(setData)
}, [params])

<Reaktiform
  sortingMode="server"
  data={data}
  onSortChange={useCallback(({ sortBy, sortDir }) => {
    setParams(p => ({ ...p, sortBy, sortDir }))
  }, [])}
  onSearchChange={useCallback((search) => {
    setParams(p => ({ ...p, search }))
  }, [])}
/>
```

> **Important:** Wrap callbacks in `useCallback` — inline arrow functions recreate on every render and cause infinite re-render loops in server mode.

---

## Infinite scroll

```tsx
const [data, setData]       = useState<Project[]>([])
const [total, setTotal]     = useState<number>()
const [loading, setLoading] = useState(true)
const [more, setMore]       = useState(false)

// Initial load
useEffect(() => {
  api.getProjects({ offset: 0, limit: 30 }).then(res => {
    setData(res.rows)
    setTotal(res.total)
    setLoading(false)
  })
}, [])

<Reaktiform
  sortingMode="server"
  data={data}
  isLoading={loading}
  isFetchingMore={more}
  totalRows={total}            // virtualiser uses this for correct scrollbar height
  fetchThreshold={15}          // fetch when 15 rows from end
  pageSize={30}
  onFetchMore={async ({ offset, limit }) => {
    setMore(true)
    const res = await api.getProjects({ offset, limit })
    setData(prev => [...prev, ...res.rows])  // APPEND, don't replace
    setMore(false)
  }}
/>
```

---

## Value transform (backend shape mapping)

When your API returns nested objects instead of flat IDs:

```ts
// API returns:  { owner: { id: 'user_1', name: 'Alice' } }
// API expects:  { owner: { id: 'user_1' } }
// Reaktiform stores internally as: 'user_1'

{
  key: 'owner', type: 'select', options: userOptions,
  valueTransform: {
    read:  (raw) => (raw as any)?.id ?? raw,   // object → flat string
    write: (val) => ({ id: val }),              // flat string → object
  }
}

// Array of objects (multiselect):
// API: { tags: [{ id: 'tag_1', name: 'Phase 1' }] }
{
  key: 'tags', type: 'multiselect', options: tagOptions,
  valueTransform: {
    read:  (raw) => (raw as any[]).map(t => t.id),
    write: (val) => (val as string[]).map(id => ({ id })),
  }
}
```

---

## Persistence (localStorage)

```tsx
// Enable — pass a unique key
<Reaktiform storageKey="projects-v1" ... />

// Persists: column widths, order, visibility, pin state,
//           sort, filters, group-by, aggregations, CF rules

// Clear programmatically (e.g. "Reset preferences" button)
import { clearPersistedState } from 'reaktiform'
clearPersistedState('projects-v1')

// Invalidate after schema change — change the version suffix
storageKey="projects-v2"  // old v1 storage is ignored
```

---

## Headless mode

Use only the hook — bring your own UI:

```ts
import { useReaktiform } from "reaktiform/headless";

const grid = useReaktiform({
  columns,
  data,
  rowIdKey: "id",
  onUpdate: saveRow,
});

// grid.rows          — current rows (with draft values applied)
// grid.processedRows — TanStack rows (sorted, filtered, grouped)
// grid.setSort(key)  — trigger sort
// grid.setFilter(key, value) — apply filter
// grid.markDirty(rowId, field, value) — mark cell as edited
// grid.saveRow(rowId) — save + call onUpdate
// grid.isDirty(row)   — check if row has unsaved changes
```

---

## Features overview

| Feature                         | Default |
| ------------------------------- | ------- |
| Inline edit — all column types  | ✅ on   |
| Sort (asc → desc → none)        | ✅ on   |
| Per-column filter               | ✅ on   |
| Global search                   | ✅ on   |
| Group by column                 | ✅ on   |
| Column resize                   | ✅ on   |
| Column pin (sticky)             | ✅ on   |
| Column show/hide                | ✅ on   |
| Column reorder (drag)           | ✅ on   |
| Keyboard navigation             | ✅ on   |
| Undo / Redo (Ctrl+Z/Y)          | ✅ on   |
| Bulk select + delete            | ✅ on   |
| Aggregation (Σ sum/avg/min/max) | ✅ on   |
| CSV export                      | ✅ on   |
| Conditional formatting          | ✅ on   |
| Detail side panel               | ✅ on   |
| Infinite scroll                 | ✅ on   |
| localStorage persistence        | ✅ on   |
| Async + Creatable select        | ✅ on   |
| Value transform                 | ✅ on   |
| Custom validation               | ✅ on   |
| Server-side sort/filter/search  | ✅ on   |
| Headless mode                   | ✅ on   |

---

## API reference

See full TypeScript types for all props:

```ts
import type {
  GridConfig, // all <Reaktiform> props
  ColumnDef, // column definition
  GridFeatures, // feature flags
  FetchMoreParams, // onFetchMore callback params
  SortChangeParams, // onSortChange callback params
} from "reaktiform";
```

All props have inline JSDoc — hover any prop in your editor for documentation.

---

## License

MIT © Surya Baskaran
