# Changelog

All notable changes to reaktiform will be documented here.

## [1.2.5] — 2026-07-03

### Added

- `GridFeatures.showActiveFilterChips` — set to `false` to hide the
  "Active filters: ..." chip bar that shows above the toolbar when one or
  more column filters are active. Default: `true` (unchanged behavior).
- `ColumnDef.aggregatable` — set to `false` to hide the aggregation
  control for a specific number column (e.g. for dynamic/backend-computed
  columns that don't support aggregation). Default: `true`.

### Changed

- **Breaking (unpublished, no consumers affected yet):** `TextFilterValue`'s
  field is now `value` instead of `text` — `{ type: 'text', value: string }`,
  matching every other `FilterValue` variant's naming and the shape expected
  by consumers of the new controlled `filters` prop. Update any code reading
  `activeFilters[col].text` for text-type filters to `.value`.
- `GridConfig.autoHeight` — when `true`, the grid fills 100% of its parent
  container's height via flexbox instead of the `maxHeight`/`minHeight`
  viewport-relative defaults. Opt-in; requires the grid to sit inside a
  properly sized flex ancestor (e.g. `<div className="flex-1 min-h-0">`).

### Fixed

- `autoHeight` mode's root grid div was missing `min-h-0` alongside its
  conditional `h-full` — as a flex item inside a consumer's own flex-fill
  container, it defaulted to `min-height: auto` and refused to shrink
  below its own content's natural height, so the grid grew to fit all
  rows instead of clipping to the space it was given and handing
  scrolling to its internal scroll container. Only affects `autoHeight`
  consumers.
- Dark mode was broken in all 4 of the grid's portaled overlay panels
  (`FilterPanel`, the Conditional Formatting panel, the Columns visibility
  panel, and the row error popover) — they always rendered with light-mode
  colors regardless of the app's theme, because they render via
  `createPortal` outside the main grid's `[data-reaktiform]`-scoped DOM
  subtree, and nothing applied that scope (or an equivalent) to their
  portal roots. `FilterPanel` and the Conditional Formatting panel also
  hardcoded literal hex colors instead of referencing the `--rf-*` theme
  variables at all. All 4 panels now carry `data-reaktiform` (+ a
  conditional `.dark` class) on their portal root and use the same
  `var(--rf-*)` tokens as the rest of the grid, so they correctly follow
  the app's theme. User-facing fixed colors (the 8 conditional-formatting
  color presets, star-rating fill color, and the native color-input
  fallback default) are intentionally unchanged.
- Column filters can now be driven from outside the grid. Added an optional
  controlled `filters` prop (`GridConfig.filters`) — when passed, external
  changes (saved filters, URL state, an app-level filter panel, etc.) now
  sync into the grid's internal filter state and its column filter UI
  reflects them. Previously the grid's `activeFilters` was 100% internal
  once mounted; only `onFilterChange` (grid → consumer) existed, so
  externally-driven filter changes never reached the column filter
  icons/badges/popups even though `onFilterChange` correctly notified the
  consumer of grid-driven changes. Omitting `filters` preserves the exact
  prior uncontrolled behavior.
- Fixed a column `FilterPanel` popup showing stale form values if its
  column's filter changed (from any source) while the popup was already
  open — the popup's local form state now resets whenever the filtered
  column or the underlying filter value changes.
- Fixed `ReaktiformPanel` (the row detail side drawer) not spanning the
  full viewport height — it previously started 56px below the true top
  regardless of the host app's layout; it now correctly covers the full
  screen like every other overlay in the library.
- Fixed `sortable: false`, `filterable: false`, and `resizable: false` on a
  column having no effect — the sort area, filter button, and resize
  handle in the column header now correctly hide when these flags are set,
  matching how `groupable` already worked. Previously these flags were
  computed into unused internal TanStack config and never consulted by
  the actual header rendering.

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
