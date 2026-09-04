# Changelog

All notable changes to reaktiform will be documented here.

## [Unreleased]

### Added

- **Panel mode switcher.** A toolbar popover lets the user pick how records
  display — side drawer, center modal, or full page — persisted to
  localStorage alongside column widths, filters and CF rules.
  - New `initialPanelMode` (uncontrolled seed), `onPanelModeChange`, and
    `panelModes` (restrict which options the popover offers). `panelMode`
    keeps its name and becomes the **controlled** value: passing it hides the
    switcher, exactly as `editLocked` relates to `initialEditLocked`.
  - `features.panelModeSwitcher: false` hides the button; it is also hidden
    automatically when `features.sidePanel` is off.
  - Switching with a record open re-shells live — the panel stays open and any
    unsaved draft survives. Note the switcher is inherently a *panel-closed*
    control: the drawer/modal backdrop covers the toolbar while open, and page
    mode hides the toolbar outright.
  - **The persisted shape gained `panelMode` WITHOUT a `STORAGE_VERSION` bump.**
    A version mismatch deletes the whole payload, which would have cost every
    user their column widths, hidden/pinned columns, order, filters,
    aggregations and CF rules to add one optional field. Additive fields are
    now documented at the version constant as never needing a bump.

- **Responsive panel field grid.** Detail panel fields flow into 1, 2 or 3
  columns based on the width of the form itself (measured, so a 440px drawer
  stays single-column on any monitor while a full-page record gets three).
  - New `ColumnDef.isFullRow` opts a field into a whole row. `richtext` and
    multiline `text` are always full-row regardless — a WYSIWYG toolbar in a
    third of a row is unusable.
  - **This is a visible change wherever the panel is wider than 560px**
    (modal and page). The panel form had effectively been single-column for
    every consumer because the grid container was missing `display: grid`
    entirely, which made every per-field span class dead code. Drawer mode is
    unaffected.

- **Custom panel tabs.** `panelTabs` now accepts full tab definitions alongside
  the built-in `'details'`/`'activity'`/`'files'` names, so a consumer can add
  their own record-scoped tabs (audit trail, linked records, approvals) without
  forking the panel. Entries render in the order listed. New exported types
  `PanelTabDef`, `CustomPanelTab`, `PanelTabContext`.
  ```tsx
  panelTabs={[
    'details',
    { id: 'history', label: 'History', icon: Clock, badge: 4,
      render: ({ row, values }) => <AuditTrail recordId={row.id} /> },
    'files',
  ]}
  ```
  - A tab supplies its body via `render: (ctx) => ReactNode` rather than a
    component reference — a `component:` defined inline gets a new identity on
    every render, which would remount the tab and wipe its local state on every
    keystroke elsewhere in the panel.
  - The render context carries `row`, `rowId`, `values` (the row **merged with
    its pending draft**), `columns`, `isDirty`, `isSaving`, `canEdit`,
    `editLocked`, and `setValue`/`save`/`discard`/`close`. `setValue` and `save`
    route through the same draft pipeline the Details tab uses, so a custom
    tab's edits show live in the grid and run through validation.
  - **`setValue`/`save` are hard no-ops under Edit Lock or `canEdit: false`**
    (dev-mode warning), so a custom tab can never widen what permissions already
    allow — the same "narrow, never widen" guarantee as every other mutation path.
  - Optional per-tab `icon`, `badge`, `visible` (`boolean` or per-row function),
    and `showFooter` to opt into the Save/Discard footer.
  - Reserved ids: a custom tab using `details`/`activity`/`files` is skipped with
    a dev-mode warning; the built-in wins.
  - The tab strip now scrolls horizontally instead of crushing labels once there
    are more tabs than fit, with chevron buttons at either edge as the scroll
    affordance (the native scrollbar is hidden — it ate a row of vertical space
    under the tabs and read as a rendering glitch). Each arrow appears only when
    there is content to reveal that way. With the three built-ins nothing
    overflows, so no arrows show and the layout is unchanged.

- **`panelMode` — detail panel as a drawer or a modal.** New `GridConfig`
  prop `panelMode?: 'drawer' | 'modal'` (default `'drawer'`, so existing
  consumers are unaffected), plus `panelWidth?: number` to size it. The
  same `mode` prop is available on `<ReaktiformPanel>` for standalone use.
  Only the panel's *shell* changes — the tabs, form, footer, prev/next
  navigation, and every permission/`editLocked` gate are shared verbatim
  between the two modes.
  - **`'modal'`** centers the panel over a darker scrim, capped at
    `min(panelWidth, 92vw)` × `85vh` with the tab body scrolling inside and
    the footer pinned. It carries real dialog semantics: `role="dialog"`,
    `aria-modal`, `aria-labelledby` on the header title, focus moved into
    the shell on open and restored to the previously-focused element on
    close, Esc-to-close, and a Tab focus trap. The trap wraps on Tab only
    and never steals focus back on `focusin`, so React Select's
    `document.body`-portaled menus keep working inside the modal.
  - **`'drawer'`** is byte-for-byte the previous behaviour: right-anchored,
    full height, slide-in transition, non-modal (Esc does not close it and
    focus is never stolen).
- New exported type `PanelMode`.

### Fixed

- **Detail panel shell no longer depends on the consumer shipping Tailwind.**
  The shell's geometry came from utility classes (`fixed`, `inset-y-0`,
  `right-0`, `z-[150]`, `bg-rf-surface`, …), but `inset-y-0` and `z-[150]`
  are not defined in `reaktiform.css` at all, and the ones that *are*
  defined are scoped as `[data-reaktiform]` **descendants** — so they never
  matched the panel root, which carries `data-reaktiform` itself. In a
  Tailwind app the consumer's own utilities silently filled both gaps; a
  non-Tailwind consumer got an unpositioned panel, and standalone
  `<ReaktiformPanel>` usage (outside a grid) got no shell styling at all.
  Shell geometry and surface are now inline styles reading the
  `--rf-*` CSS vars, which resolve on the element in every case.

- **Panel tab strip no longer renders an empty body when Details is excluded.**
  `panelTabs={['files']}` showed a Files tab over blank space: the active tab
  both initialised to and fell back to a hardcoded `'details'`, an id that
  wasn't in the list, so no tab body matched. The active tab now resolves to
  the first available tab.

## [1.2.10] — 2026-07-23

### Added

- **`richtext` column type** — a new `ColumnDef.type: 'richtext'` for HTML
  content (bold, italic, headings, bullet/numbered lists, blockquotes),
  powered by Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`,
  new runtime dependencies). New optional `ColumnDef` props: `placeholder`,
  `minHeight`, `previewLength`.
  - **Grid:** clicking the cell opens an **anchored popover**
    (`RichTextPopover`) with the full WYSIWYG toolbar — a table cell has no
    room for a toolbar + multi-paragraph editor, so editing does not happen
    inline in the `<td>` the way other column types do. Edits are buffered
    locally and only committed via an explicit Save button (Cancel/Escape/
    backdrop-click discards). The closed cell shows a cheap, stripped
    plain-text preview (no HTML formatting, no per-row Tiptap mount — safe
    for virtualized scroll).
  - **Panel:** the editor is embedded directly in the form (no popover, no
    buffering — same live-typing-updates-grid wiring every other field
    uses). Read-only/Edit-Locked richtext fields render via `RichTextViewer`
    instead of the generic `String(value)` fallback, so formatting still
    displays correctly.
  - **Filtering:** richtext columns get the same "contains" text filter as
    `text`/`email`/`url` (matches against the raw HTML string — a search
    phrase split across a formatting-tag boundary won't match; accepted
    trade-off, not a bug).
  - **Security:** richtext content is never rendered via raw
    `dangerouslySetInnerHTML` anywhere in reaktiform — always through
    Tiptap's own schema-constrained HTML parsing, or through plain-text
    extraction for previews. `StarterKit`'s `link` extension is explicitly
    disabled (`link: false`) since the toolbar never offers a way to insert
    one — see `CLAUDE.md`'s richtext decision for the full reasoning.

### Fixed

- The grid's outside-click cancel handler (`Reaktiform.tsx`) and
  `useKeyboardNav`'s input-skip check both assumed every cell editor rendered
  inline inside its own `<td>`. Neither held for a `document.body`-portaled
  editor: the first click inside such a popover would immediately cancel
  the edit, and its `contentEditable` surface never matched the
  `INPUT`/`TEXTAREA`/`SELECT` tag check, so the grid's global keyboard nav
  fought the editor's own cursor movement. Both fixed as part of landing
  the richtext popover — see `CLAUDE.md`'s "Common Bugs to Avoid" #10/#11.

## [1.2.9] — 2026-07-22

### Added

- **Edit Lock** — a session-level "child lock" toggle (`GridConfig.editLocked`,
  `onEditLockedChange`, `initialEditLocked`, `features.editLock`, exposed at
  runtime as `grid.editLocked`/`grid.toggleEditLocked()`). When engaged, the
  grid behaves as if `permissions={{ canCreate: false, canEdit: false,
  canDelete: false, canDuplicate: false, canSave: false }}` regardless of
  what `permissions` actually allows — a self-imposed, reversible safety
  toggle (à la Excel's "Mark as Final" or Notion/Airtable's "Lock
  database/view") for users who already have edit rights but want to browse
  without risking an accidental edit. Navigation, selection, filtering,
  sorting, export, comments, and file uploads remain fully usable while
  locked. It only ever narrows what `permissions` allows, never widens it —
  `permissions` remains the real authorization boundary. A toolbar toggle is
  shown by default (hide via `features={{ editLock: false }}`); state
  persists across reloads via `storageKey`, same as column widths/filters.

### Fixed

- Pressing `Enter` on a keyboard-focused cell bypassed `readOnly` /
  `GridPermissions` entirely and opened the editor anyway — the click path
  checked `canEditCell` before activating a cell, but the keyboard path
  (`useKeyboardNav`'s `Enter` handler) called `activateCell` directly with
  no such check. Both paths now go through one shared gate
  (`activateCellIfAllowed` in `Reaktiform.tsx`), so keyboard-triggered
  editing respects read-only columns, row/column permissions, and Edit
  Lock exactly like a mouse click does.

### Performance

- **Row rendering is now `React.memo`'d.** Extracted into a new `GridRow`
  component (previously inline in `Reaktiform.tsx`'s virtualizer loop) so
  that scrolling, selecting, editing, or locking one row no longer
  re-renders every visible row. Measured on a 5,000-row / 20-column dataset:
  scroll frame rate roughly doubled (continuous scroll ~28→37fps, fast
  scroll ~16→38fps). No behavior change — same z-index/pinned-column
  stacking, same click/keyboard/expand/selection semantics, purely a
  render-scope fix. See `CLAUDE.md`'s "GridRow extraction overrides a prior
  decision" note and rule 10 if you're adding new props to `GridRow`.
- Cell editors (`TextCellEdit`, `NumberCellEdit`, `DateCellEdit`,
  `TimeCellEdit`) now focus/select synchronously before paint
  (`useLayoutEffect` instead of `useEffect`), removing a brief
  unfocused-input flash on every click-to-edit.
- The virtualizer's `estimateSize` callback no longer depends on the full
  `displayRows` array reference (which changes on every edit) — it reads
  the current rows through a ref instead, so editing a cell doesn't force
  `@tanstack/react-virtual` to treat the sizing function as changed and
  recompute cached offsets for the whole dataset.
- **Known remaining issue, not yet resolved:** a single cell edit still
  produces 3 separate React commits (~225-350ms each per React Profiler
  data) instead of one batched commit, despite the three underlying store
  updates firing synchronously in one handler. Root cause not yet
  identified — see `CLAUDE.md`'s Performance section before investigating
  further.

## [1.2.8] — 2026-07-09

### Fixed

- Infinite-scroll (`onFetchMore`) could get permanently stuck showing
  skeleton/loading rows after the first page or two, even though more
  data existed (`hasMore` still `true`). The internal
  `isFetchingMoreRef` guard that prevents double-fetching during a
  scroll burst had exactly one reset path — the `.finally()` on the
  promise returned by the consumer's `onFetchMore`. If that promise's
  settlement was ever lost (e.g. a query-key change cancels/replaces
  the in-flight request before it settles), the guard stayed `true`
  forever and silently blocked every future fetch for the life of the
  component — only a full unmount/remount (e.g. navigating to another
  tab and back) cleared it, and only temporarily. The guard is now
  self-healing: it resets the instant the loaded row count actually
  grows (proof a pending fetch settled), and — as a backstop for a
  fetch that never settles at all — force-resets after a bounded
  10-second stall timeout so the next scroll can retry. No behavior
  change for the normal/working case; the in-flight de-dupe guarantee
  is unaffected.

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
