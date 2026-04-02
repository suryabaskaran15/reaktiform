# Changelog

All notable changes to reaktiform will be documented here.

## [1.0.0] — 2025-01-01

### Initial release

#### Components

- `<Reaktiform>` — inline-editable data grid with full feature set
- `<ReaktiformPanel>` — detail side panel with tabs (Details / Activity / Files)

#### Column types

- `text`, `number`, `select`, `multiselect`, `date`, `checkbox`
- Async select (`loadOptions`) — search options from server as user types
- Creatable select (`onCreateOption`) — let users create new options
- Async + Creatable combined

#### Grid features

- Sort — 3-state cycle: asc → desc → none
- Filter — per column, all types (text contains, number range, date range, select multi-pick)
- Global search
- Group by column (collapsible)
- Column resize (drag right edge)
- Column pin (sticky left)
- Column show/hide panel
- Column reorder (drag ⠿ grip)
- Inline cell edit — click to edit, Tab/Enter to commit, Esc to cancel
- Keyboard navigation (arrow keys, Enter, Space, Esc)
- Undo / Redo (Ctrl+Z / Ctrl+Y)
- Per-row save / discard
- Save All / Discard All
- Add row, duplicate row, delete row
- Bulk select + bulk delete
- Aggregation per number column (sum / avg / min / max / count)
- CSV export
- Conditional formatting (rules editor with color picker)
- Detail side panel (ReaktiformPanel)
- Loading skeleton
- Infinite scroll with pre-fetch (onFetchMore)

#### Data management

- Client-side mode — TanStack Table handles sort/filter/search in memory
- Server-side mode — callbacks fire for sort/filter/search, consumer re-fetches
- `valueTransform` — map between flat internal values and nested API shapes
- Custom `validate` function per column — supports cross-field validation
- localStorage persistence via `storageKey` prop

#### Developer experience

- Full TypeScript generics — `<Reaktiform<MyRow>>`
- Headless mode — `useReaktiform` hook from `reaktiform/headless`
- All props documented with JSDoc (hover in IDE for descriptions + examples)
- Zero flash on persistence restore — loaded synchronously before first paint

#### Performance

- TanStack Virtual — only visible rows rendered in DOM
- React.memo on ColumnHeader — headers don't re-render on scroll
- Stable per-column callback maps — no new functions on each render
- Zod schema cached — rebuilt only when columns change, not on every keystroke
- CSS transition on ReaktiformPanel — framer-motion removed (~40KB saved)
