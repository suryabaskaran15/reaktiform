"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  useMemo,
} from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  MessageSquare,
  Paperclip,
  FileCheck,
  Lock,
} from "lucide-react";
import { cn } from "../../utils";
import { DetailsTab } from "./DetailsTab";
import { ActivityTab } from "./ActivityTab";
import { AttachmentsTab } from "./AttachmentsTab";
import { useAttachmentUploads } from "../../hooks/useAttachmentUploads";
import { Spinner } from "../primitives/Spinner";
import { mergedRow } from "../cells/CellRenderer";
import type {
  ColumnDef,
  CustomPanelTab,
  PanelMode,
  PanelTabContext,
  PanelTabDef,
  Row,
  RowAttachment,
  UploadProgressReporter,
} from "../../types";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────
/**
 * A tab's id. The three built-ins below are reserved; everything else is a
 * consumer-supplied {@link CustomPanelTab} id.
 */
type TabId = string;

const TAB_DETAILS = "details";
const TAB_ACTIVITY = "activity";
const TAB_ATTACHMENTS = "attachments";

/**
 * Reserved ids, keyed by the name used in the public `panelTabs` API.
 * Note the built-in attachments tab is `'files'` publicly but `'attachments'`
 * internally — that mapping predates custom tabs and is kept for compatibility.
 */
const RESERVED_TAB_IDS = new Set([
  TAB_DETAILS,
  TAB_ACTIVITY,
  TAB_ATTACHMENTS,
  "files",
]);

/** One entry in the rendered tab strip, built-in or custom. */
type ResolvedTab<TData> = {
  id: TabId;
  label: string;
  icon?: React.ElementType | undefined;
  badge?: string | number | undefined;
  /** Present only for consumer-defined tabs. */
  custom?: CustomPanelTab<TData> | undefined;
};

/** Width of one tab-strip scroll arrow, and of the pair. */
const TAB_ARROW_W = 28;
const TAB_ARROWS_W = TAB_ARROW_W * 2;

/**
 * End affordance for a tab strip that overflows, replacing the native
 * horizontal scrollbar (which ate a row of vertical space under the tabs and
 * read as a rendering artifact rather than a control).
 *
 * Laid out INLINE beside the scroll area, never as an overlay on top of it, so
 * no tab is ever partly hidden underneath an arrow. Both arrows render together
 * whenever the strip overflows; the one at its travel limit is `disabled`
 * rather than removed, which keeps the strip's width — and the click target —
 * from moving under the pointer mid-interaction.
 *
 * `tabIndex={-1}` deliberately: this is a redundant pointer affordance, and
 * keyboard users reach every tab by tabbing through the tab buttons themselves,
 * which scrolls them into view natively.
 */
function TabScrollArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll tabs left" : "Scroll tabs right"}
      onClick={onClick}
      className={cn(
        "rf-flex rf-items-center rf-justify-center rf-flex-shrink-0 rf-transition-colors",
        disabled ? "text-rf-text-3" : "text-rf-text-2 hover:text-rf-accent",
      )}
      style={{
        width: TAB_ARROW_W,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Icon className="rf-icon-sm" />
    </button>
  );
}

/** Tab-cycle candidates for the modal focus trap. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
]
  // A tabIndex={-1} element is unreachable by Tab, so it must never be a wrap
  // point for the trap (the tab-strip scroll arrows are exactly this).
  .map((sel) => `${sel}:not([tabindex="-1"])`)
  .join(",");

export type ReaktiformPanelProps<TData = Record<string, unknown>> = {
  row: Row<TData> | null;
  columns: ColumnDef<TData>[];
  rowIdKey?: string;
  isOpen: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSave: (rowId: string, draft: Record<string, unknown>) => void;
  onDiscard: (rowId: string) => void;
  /**
   * Called on every field change in the detail panel form.
   * Use this to update the table row live as the user types.
   * The grid wires this to grid.markDirty internally.
   */
  onFieldChange?: (rowId: string, field: string, value: unknown) => void;
  /**
   * Live formula evaluator for `computed: true` columns — the same
   * `grid.getComputedValue` function passed to GridRow for inline editing.
   * Threaded to DetailsTab's "Computed Values" section so panel edits
   * recalculate instantly, same as inline. If omitted (standalone
   * ReaktiformPanel usage without a computed-columns engine), falls back
   * to reading the field directly off `row`.
   */
  getComputedValue?: (row: Row<TData>, colKey: string) => unknown;
  onAddComment?: (rowId: string, text: string) => void;
  /** Load file attachments for a row when its detail panel opens. */
  onLoadAttachments?: (rowId: string) => Promise<RowAttachment[]>;
  onUploadFile?: (
    rowId: string,
    files: File[],
    helpers?: { onProgress: UploadProgressReporter; fileIds: string[] },
  ) => Promise<RowAttachment[]>;
  onDeleteAttachment?: (rowId: string, attachmentId: string) => Promise<void>;
  /** Render a custom component for each attachment row, replacing the built-in row. */
  renderAttachment?: (
    attachment: RowAttachment,
    helpers: { onDelete: () => void },
  ) => React.ReactNode;
  /**
   * How the panel presents itself: `'drawer'` (default) slides in from the
   * right edge full-height; `'modal'` is a centered dialog over a scrim,
   * with `role="dialog"`, Esc-to-close, and a Tab focus trap.
   * Contents are identical in both modes — only the shell changes.
   */
  mode?: PanelMode;
  /**
   * Panel width in pixels. Defaults to `440` (drawer) and `720` (modal).
   * Page mode has no default — it fills the full width of the box the grid
   * vacated; pass a width to cap and centre it instead.
   * In modal mode the panel never exceeds `92vw`, so there too it is an
   * upper bound rather than a fixed width.
   */
  width?: number;
  /**
   * Label on the page-mode back button. Ignored in drawer/modal mode.
   * @default "Back to table"
   */
  backLabel?: string;
  /**
   * Page mode only — the height the record fills before its body starts
   * scrolling internally. Mirrors the grid's own `maxHeight`, and `<Reaktiform>`
   * passes its value straight through, so a record page occupies exactly the
   * box the table did. Drawer and modal are bounded by the viewport instead
   * and ignore this.
   * @default "calc(100vh - 300px)"
   */
  maxHeight?: string | number;
  /**
   * Page mode only — floor height, mirroring the grid's `minHeight`.
   * @default 380
   */
  minHeight?: string | number;
  /**
   * Page mode only — fill a `flex-1` ancestor instead of using `maxHeight`.
   * Mirrors the grid's `autoHeight`.
   */
  autoHeight?: boolean;
  className?: string | undefined;
  // ── Tab control
  /**
   * Which tabs to show, in strip order. Entries are either a built-in tab's
   * name or a full custom tab definition (see `CustomPanelTab`).
   * Defaults to all built-ins: ['details', 'activity', 'files'].
   * Tabs are also auto-hidden when their callback is missing.
   */
  panelTabs?: PanelTabDef<TData>[] | undefined;
  // ── Permission control
  /** Allow saving from the panel. Default: true */
  canSave?: boolean;
  /** Allow editing fields in the panel. Default: true */
  canEdit?: boolean;
  /**
   * Edit Lock — session-level "child lock" (see `GridConfig.editLocked`).
   * When true, every field renders as its read-only static display,
   * regardless of `canEdit` / per-column `readOnly`. Default: false
   */
  editLocked?: boolean;
  /** Allow adding comments. Default: true */
  canComment?: boolean;
  /** Allow uploading files. Default: true */
  canUploadFiles?: boolean;
  /** Allow selecting/dropping more than one file at a time in the Files tab. Default: false */
  allowMultipleFileUpload?: boolean;
};

// ─────────────────────────────────────────────────────────────
//  MAIN ReaktiformPanel
// ─────────────────────────────────────────────────────────────
export function ReaktiformPanel<TData = Record<string, unknown>>({
  row,
  columns,
  rowIdKey = "id",
  isOpen,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  onClose,
  onSave,
  onDiscard,
  onFieldChange,
  getComputedValue = (r, k) => (r as Record<string, unknown>)[k],
  onAddComment,
  onLoadAttachments,
  onUploadFile,
  onDeleteAttachment,
  renderAttachment,
  mode = "drawer",
  width,
  backLabel = "Back to table",
  maxHeight,
  minHeight,
  autoHeight = false,
  className,
  panelTabs,
  canSave = true,
  canEdit = true,
  editLocked = false,
  canComment = true,
  canUploadFiles = true,
  allowMultipleFileUpload = false,
}: ReaktiformPanelProps<TData>) {
  const [activeTabState, setActiveTab] = useState<TabId>(TAB_DETAILS);
  // Incremented when Discard is clicked — forces DetailsTab to reset RHF state
  const [resetKey, setResetKey] = useState(0);

  const rowId = row
    ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
    : "";
  // const description = row
  //   ? String((row as Record<string, unknown>)["description"] ?? "")
  //   : "";
  // const rowLabel = row
  //   ? String((row as Record<string, unknown>)[rowIdKey] ?? row._id)
  //   : "";
  const isDirty = !!row?._draft;
  const hasErrors = Object.keys(row?._errors ?? {}).length > 0;

  const {
    loadedAttachments,
    attachmentsLoading,
    pendingUploads,
    handleAttachmentUpload,
    handleRetryUpload,
    handleDismissUpload,
    handleAttachmentDelete,
  } = useAttachmentUploads({
    rowId,
    isOpen,
    initialAttachments: row?._attachments,
    ...(onUploadFile !== undefined && { onUploadFile }),
    ...(onLoadAttachments !== undefined && { onLoadAttachments }),
    ...(onDeleteAttachment !== undefined && { onDeleteAttachment }),
  });

  // ── TAB RESOLUTION ───────────────────────────────────────────
  // One pass builds the whole strip, built-in and custom alike:
  // 1. No panelTabs prop → all three built-ins, in their canonical order
  // 2. Otherwise walk panelTabs IN ORDER; a string resolves to its built-in,
  //    an object to a custom tab
  // 3. Built-ins still auto-hide when their feature callback is absent
  // 4. Custom tabs resolve `visible` per row; they are never auto-hidden
  const TABS = useMemo<ResolvedTab<TData>[]>(() => {
    const builtIn: Record<string, ResolvedTab<TData>> = {
      [TAB_DETAILS]: { id: TAB_DETAILS, label: "Details", icon: FileCheck },
      [TAB_ACTIVITY]: {
        id: TAB_ACTIVITY,
        label: "Activity",
        icon: MessageSquare,
      },
      [TAB_ATTACHMENTS]: {
        id: TAB_ATTACHMENTS,
        label: "Files",
        icon: Paperclip,
      },
    };
    // A built-in whose backing callback wasn't provided has nothing to show.
    const builtInEnabled = (id: string) =>
      (id !== TAB_ACTIVITY || !!onAddComment) &&
      (id !== TAB_ATTACHMENTS || !!onUploadFile);

    if (!panelTabs) {
      return [TAB_DETAILS, TAB_ACTIVITY, TAB_ATTACHMENTS]
        .filter(builtInEnabled)
        .map((id) => builtIn[id]!);
    }

    const out: ResolvedTab<TData>[] = [];
    for (const entry of panelTabs) {
      if (typeof entry === "string") {
        // 'files' is the public name for the internal 'attachments' tab
        const id = entry === "files" ? TAB_ATTACHMENTS : entry;
        const tab = builtIn[id];
        if (tab && builtInEnabled(id)) out.push(tab);
        continue;
      }

      // A custom tab may not shadow a built-in — the built-in wins, so a
      // collision can't silently delete Details out from under the user.
      if (RESERVED_TAB_IDS.has(entry.id)) {
        if (process.env["NODE_ENV"] !== "production") {
          console.warn(
            `[reaktiform] Custom panel tab id "${entry.id}" is reserved for a built-in tab and was ignored. Use a different id.`,
          );
        }
        continue;
      }

      const visible =
        typeof entry.visible === "function"
          ? row
            ? entry.visible(row)
            : false
          : entry.visible !== false;
      if (!visible) continue;

      out.push({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        badge: entry.badge,
        custom: entry,
      });
    }
    return out;
  }, [panelTabs, onAddComment, onUploadFile, row]);

  // If the selected tab is gone (hidden, removed, or never in the list), fall
  // back to the FIRST available tab — NOT a hardcoded "details", which may not
  // be in the list at all (panelTabs={['files']}, or an all-custom strip).
  // Derived during render rather than corrected in an effect, so there is no
  // frame where the strip and the body disagree.
  const activeTab = TABS.some((t) => t.id === activeTabState)
    ? activeTabState
    : (TABS[0]?.id ?? TAB_DETAILS);

  const activeCustomTab = TABS.find((t) => t.id === activeTab)?.custom;

  // ── TAB STRIP OVERFLOW ───────────────────────────────────────
  // The strip scrolls, but its scrollbar is hidden (.rf-tabstrip) in favour of
  // the chevron buttons — so this tracks which directions still have content.
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabScroll, setTabScroll] = useState({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });

  const syncTabScroll = useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;

    setTabScroll((prev) => {
      // Hysteresis. The arrows are laid out inline, so showing them shrinks the
      // strip by TAB_ARROWS_W — a plain `max > 0` test can then flip back and
      // forth inside a band that narrow. Once shown, keep them until the
      // content would fit *without* them (i.e. max would drop to <= 0).
      const overflowing = prev.overflowing ? max > TAB_ARROWS_W : max > 0;
      // 1px slack: fractional layout widths otherwise leave an arrow enabled at
      // a travel limit with nothing left to reveal.
      const next = {
        overflowing,
        atStart: el.scrollLeft <= 1,
        atEnd: el.scrollLeft >= max - 1,
      };
      // onScroll fires on every frame of a smooth scroll — don't re-render the
      // whole panel unless something actually changed.
      return prev.overflowing === next.overflowing &&
        prev.atStart === next.atStart &&
        prev.atEnd === next.atEnd
        ? prev
        : next;
    });
  }, []);

  useEffect(() => {
    syncTabScroll();
    const el = tabStripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Panel resize, drawer↔modal switch, or a tab appearing/disappearing all
    // change whether there is anything to scroll to.
    const ro = new ResizeObserver(syncTabScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTabScroll, TABS.length, isOpen, mode]);

  const scrollTabs = useCallback((dir: 1 | -1) => {
    const el = tabStripRef.current;
    if (!el) return;
    const step = dir * Math.max(el.clientWidth * 0.7, 120);
    if (typeof el.scrollBy === "function") {
      el.scrollBy({ left: step, behavior: "smooth" });
    } else {
      el.scrollLeft += step; // jsdom / very old browsers
    }
  }, []);

  // Keep the selected tab on screen — it can otherwise sit off to one side
  // after a record change, a tab being hidden, or programmatic selection.
  useEffect(() => {
    const active = tabStripRef.current?.querySelector<HTMLElement>(
      '[data-rf-tab-active="true"]',
    );
    active?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  // ── CUSTOM TAB RENDER CONTEXT ────────────────────────────────
  // Built only when a custom tab is actually showing. `setValue`/`save` route
  // through the same callbacks the Details tab uses, so a custom tab's edits
  // are ordinary draft edits — live in the grid, validated on save.
  //
  // Both are hard no-ops under Edit Lock / no edit permission: a custom tab is
  // a new mutation path, and per CLAUDE.md rule 9 those two must narrow EVERY
  // mutation path. Without this a custom tab would be a permissions bypass.
  const canMutate = canEdit && !editLocked;
  const tabContext = useMemo<PanelTabContext<TData> | null>(() => {
    if (!row || !activeCustomTab) return null;

    const blocked = (action: string) => {
      if (process.env["NODE_ENV"] !== "production") {
        console.warn(
          `[reaktiform] Custom panel tab "${activeCustomTab.id}" called ${action}() while editing is ${
            editLocked ? "locked" : "not permitted"
          }. The call was ignored — read \`canEdit\`/\`editLocked\` from the tab context and render read-only when either blocks editing.`,
        );
      }
    };

    return {
      row,
      rowId,
      values: mergedRow(row),
      columns,
      isDirty,
      isSaving: !!row._saving,
      canEdit,
      editLocked,
      setValue: (field, value) => {
        if (!canMutate) return blocked("setValue");
        onFieldChange?.(rowId, field, value);
      },
      save: () => {
        if (!canMutate) return blocked("save");
        onSave(rowId, (row._draft as Record<string, unknown>) ?? {});
      },
      discard: () => onDiscard(rowId),
      close: onClose,
    };
  }, [
    row,
    activeCustomTab,
    rowId,
    columns,
    isDirty,
    canEdit,
    editLocked,
    canMutate,
    onFieldChange,
    onSave,
    onDiscard,
    onClose,
  ]);

  // ── PRESENTATION SHELL ───────────────────────────────────────
  // The panel's contents are identical in every mode — only the shell
  // (position, transition, and the modal's dialog semantics) differs.
  // Never fork the interior JSX per mode; the one exception is the header's
  // close control, which becomes a labelled back button in page mode.
  const isModal = mode === "modal";
  const isPage = mode === "page";
  // Page mode has no width default — it fills whatever box the grid vacated.
  const panelWidth = width ?? (isModal ? 720 : 440);

  const titleId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  /** Element that had focus before the modal opened — restored on close. */
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Modal focus management. Drawer mode is deliberately non-modal and never
  // steals focus, so this is a no-op there.
  useEffect(() => {
    if (!isModal) return;
    if (isOpen) {
      lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
      // Focus the shell itself (tabIndex={-1}), not the first field — landing
      // inside a text input would drop the user mid-form with no context.
      shellRef.current?.focus({ preventScroll: true });
      return;
    }
    lastFocusedRef.current?.focus?.({ preventScroll: true });
    lastFocusedRef.current = null;
  }, [isModal, isOpen]);

  const handleShellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isModal || !isOpen) return;

      if (e.key === "Escape") {
        // stopPropagation keeps this off useKeyboardNav's window listener,
        // which would otherwise also clear the grid's cell focus behind us.
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap by wrapping Tab only — never by stealing focus back on focusin.
      // React Select menus portal to document.body (see rule 2 in CLAUDE.md);
      // a focusin-based trap would yank focus out of an open menu.
      const shell = shellRef.current;
      if (!shell) return;
      const items = Array.from(
        shell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === shell)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [isModal, isOpen, onClose],
  );

  // Shell geometry + surface are inline, not utility classes, for two reasons:
  //  1. The rf utility classes are scoped as [data-reaktiform] DESCENDANTS, so
  //     they never match this root element when <ReaktiformPanel> is rendered
  //     standalone (outside a grid). The CSS *vars* are declared on
  //     [data-reaktiform] itself — which this element carries — so var()
  //     resolves in both cases.
  //  2. `inset-y-0` and `z-[150]` are not defined in reaktiform.css at all;
  //     the old class list silently relied on the consumer app shipping
  //     Tailwind to supply them.
  const shellBase: React.CSSProperties = {
    position: "fixed",
    zIndex: 150,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "var(--rf-surface)",
    boxShadow: "var(--rf-shadow-lg)",
    visibility: isOpen ? "visible" : "hidden",
  };

  const shellStyle: React.CSSProperties = isPage
    ? {
        // Page mode is the only NON-overlay shell: it sits in the normal flow,
        // taking over the box the grid just vacated. So it drops position/
        // z-index/shadow entirely, and uses `display: none` when closed — a
        // closed page panel must occupy no space, where a hidden drawer can
        // safely keep its layout box off-screen.
        display: isOpen ? "flex" : "none",
        flexDirection: "column",
        // Also what clips the header and footer to the rounded corners below.
        overflow: "hidden",
        backgroundColor: "var(--rf-surface)",
        position: "relative",
        width: "100%",
        // Same card frame as the grid's own container, so swapping table for
        // record doesn't change the shape of the box. Fully rounded, unlike
        // the grid container's `border-t-0 rounded-b-rf-lg` — that only exists
        // because the toolbar supplies its top edge, and page mode has none.
        // Inline rather than the rf-* classes: this element carries
        // `data-reaktiform` itself, and those classes are scoped as
        // [data-reaktiform] DESCENDANTS, so they'd never match it.
        border: "1px solid var(--rf-border)",
        borderRadius: "var(--rf-radius-lg)",
        boxShadow: "var(--rf-shadow-sm)",
        // Full-bleed by default — a record page should use the space the grid
        // was using. `width`/`panelWidth` is honoured only when the consumer
        // explicitly asks for a cap, and then the shell (not each section) is
        // what gets capped and centred, which keeps the back button, tabs,
        // form and footer aligned to one column with no per-section styling.
        maxWidth: width ?? "none",
        margin: width ? "0 auto" : undefined,
        // Bound the height exactly the way the grid's own scroll container is
        // bounded (Reaktiform.tsx), because everything inside this shell
        // depends on it: the tab body's `flex-1 overflow-y-auto` only scrolls
        // against a bounded parent, and the header/tabs/footer only stay
        // pinned if the body — not the shell — is what grows. Unbounded, the
        // shell grows to content height, the body never scrolls, and the
        // record runs off the bottom of the page unreachable.
        ...(autoHeight
          ? { flex: 1, minHeight: 0 } // bounded by a flex-1 ancestor instead
          : {
              maxHeight: maxHeight ?? "calc(100vh - 300px)",
              minHeight: minHeight ?? 380,
            }),
      }
    : isModal
    ? {
        ...shellBase,
        left: "50%",
        top: "50%",
        width: `min(${panelWidth}px, 92vw)`,
        maxHeight: "85vh",
        border: "1px solid var(--rf-border)",
        borderRadius: "var(--rf-radius-lg)",
        // The shell is a programmatic focus target (tabIndex={-1}), not a
        // control — the WAI-ARIA dialog pattern. Every real control inside
        // keeps its own focus ring; this just suppresses the UA ring on the
        // container itself.
        outline: "none",
        transform: isOpen
          ? "translate(-50%, -50%) scale(1)"
          : "translate(-50%, -50%) scale(0.96)",
        opacity: isOpen ? 1 : 0,
        transition:
          "opacity 0.18s ease, transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
      }
    : {
        ...shellBase,
        top: 0,
        bottom: 0,
        right: 0,
        width: panelWidth,
        borderLeft: "1px solid var(--rf-border)",
        transform: isOpen ? "translateX(0)" : `translateX(${panelWidth + 2}px)`,
        transition: "transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)",
      };

  return (
    <>
      {/* Backdrop — only visible when open, click to close.
          Page mode has nothing behind it to dim, so it renders none. */}
      {!isPage && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 149,
            background: isModal ? "rgba(15,23,42,.45)" : "rgba(15,23,42,.25)",
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transition: "opacity 0.22s ease",
          }}
        />
      )}

      {/* Panel — always in DOM, translated off-screen when closed */}
      <div
        data-reaktiform
        data-rf-panel-mode={mode}
        ref={shellRef}
        role={isModal ? "dialog" : undefined}
        aria-modal={isModal ? true : undefined}
        aria-labelledby={isModal ? titleId : undefined}
        tabIndex={isModal ? -1 : undefined}
        onKeyDown={handleShellKeyDown}
        className={className}
        style={shellStyle}
      >
        {/* HEADER */}
        <div className="rf-flex rf-items-center rf-gap-2 px-4 py-3 border-b border-rf-border bg-rf-header rf-flex-shrink-0">
          {/* Page mode's one interior fork: an overlay gets an unlabelled ✕
              because dismissing it is obvious, but a full-page view needs to
              say where "back" goes. The ✕ below is suppressed in exchange —
              two competing dismiss controls would be worse than either. */}
          {isPage && (
            <button
              type="button"
              onClick={onClose}
              className="rf-inline-flex rf-items-center rf-gap-1 rf-flex-shrink-0 px-2 py-1 -ml-1 text-[12.5px] rf-font-medium rounded-rf-md text-rf-text-2 border border-rf-border bg-rf-surface hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br rf-transition-colors"
            >
              <ChevronLeft className="rf-icon-sm" />
              {backLabel}
            </button>
          )}
          <div className="rf-flex-1 rf-min-w-0">
            <div className="rf-flex rf-items-center rf-gap-2 mb-0.5">
              {/* <span className="text-[10.5px] rf-font-bold text-rf-text-3 rf-uppercase tracking-[.06em]">
                {rowLabel}
              </span> */}
              <div
                id={titleId}
                className="text-[14px] rf-font-semibold text-rf-text-1 rf-truncate"
              >
                {/* {description || "Record Details"} */}
                {"Record Details"}
              </div>
              {isDirty && !hasErrors && (
                <span className="text-[10px] rf-font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Unsaved
                </span>
              )}
              {hasErrors && (
                <span className="text-[10px] rf-font-bold bg-rf-err-bg text-rf-err border border-rf-err-br rounded-full px-1.5 py-0.5">
                  Errors
                </span>
              )}
            </div>
          </div>
          <div className="rf-flex rf-gap-1 rf-flex-shrink-0">
            <button
              onClick={onPrev}
              disabled={!canGoPrev}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronLeft className="w-[13px] h-[13px]" />
            </button>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-rf-surface rf-flex rf-items-center rf-justify-center text-rf-text-2 hover:bg-rf-accent-bg hover:text-rf-accent hover:border-rf-accent-br disabled:opacity-30 disabled:rf-cursor-not-allowed rf-transition-colors"
            >
              <ChevronRight className="w-[13px] h-[13px]" />
            </button>
          </div>
          {!isPage && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-rf-md border border-rf-border bg-transparent rf-flex rf-items-center rf-justify-center text-rf-text-3 hover:bg-rf-err-bg hover:text-rf-err hover:border-rf-err-br rf-transition-colors"
            >
              <X className="w-[13px] h-[13px]" />
            </button>
          )}
        </div>

        {/* TABS */}
        {/* `flex: 1 0 auto` on the buttons: with the three built-ins they still
            grow to fill the strip exactly as before, but a panel carrying
            several custom tabs scrolls instead of crushing every label into an
            unreadable sliver. The native scrollbar is hidden in favour of the
            chevron buttons flanking the strip, which appear only when there is
            actually something to scroll to. */}
        <div className="rf-flex border-b border-rf-border bg-rf-surface rf-flex-shrink-0">
          {tabScroll.overflowing && (
            <TabScrollArrow
              dir="left"
              disabled={tabScroll.atStart}
              onClick={() => scrollTabs(-1)}
            />
          )}
          <div
            ref={tabStripRef}
            data-rf-panel-tabs
            className="rf-tabstrip rf-flex"
            style={{
              flex: 1,
              // minWidth: 0 is load-bearing. As a flex ITEM the strip defaults
              // to min-width:auto, which refuses to shrink below its content
              // width — so the strip would grow past the panel and get clipped
              // instead of scrolling inside itself, leaving
              // scrollWidth === clientWidth and no arrow. Do not remove.
              minWidth: 0,
              // FUNCTIONAL, so it lives here and not in a class: this is what
              // makes the element a scroll container at all. When it was a CSS
              // class, a consumer app on a stale dist/reaktiform.css had no
              // rule for it — the div stopped being scrollable, scrollBy()
              // silently no-opped, and the arrows rendered but did nothing.
              // Only the ::-webkit-scrollbar rule stays in the stylesheet,
              // where going missing costs a visible scrollbar, not a dead
              // control. See CLAUDE.md "Common Bugs to Avoid".
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "none", // Firefox, Chrome 121+
              msOverflowStyle: "none", // legacy Edge
            }}
            onScroll={syncTabScroll}
          >
            {TABS.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                data-rf-tab-active={activeTab === id}
                onClick={() => setActiveTab(id)}
                style={{ flex: "1 0 auto", minWidth: 96 }}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2.5 px-3 text-[12px] font-medium transition-all border-b-2 whitespace-nowrap",
                  activeTab === id
                    ? "text-rf-accent border-rf-accent font-semibold"
                    : "text-rf-text-3 border-transparent hover:text-rf-text-2",
                )}
              >
                {Icon && <Icon className="rf-icon-sm" />}
                {label}
                {badge !== undefined && badge !== "" && (
                  <span
                    className={cn(
                      "text-[10px] rf-font-bold rounded-full px-1.5 py-0.5 border",
                      activeTab === id
                        ? "bg-rf-accent-bg text-rf-accent border-rf-accent-br"
                        : "bg-rf-header text-rf-text-3 border-rf-border",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tabScroll.overflowing && (
            <TabScrollArrow
              dir="right"
              disabled={tabScroll.atEnd}
              onClick={() => scrollTabs(1)}
            />
          )}
        </div>

        {/* TAB BODY — scrollable */}
        <div
          className="rf-flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {row && activeTab === TAB_DETAILS && (
            // key={rowId} forces React to unmount+remount DetailsTab when row changes.
            // This resets React Hook Form with fresh defaultValues for the new row.
            // Without this, useForm keeps stale values from the previous row.
            <DetailsTab
              key={rowId}
              row={row}
              rowId={rowId}
              columns={columns}
              editLocked={editLocked}
              canEdit={canEdit}
              resetKey={resetKey}
              getComputedValue={getComputedValue}
              onFieldChange={(field, value) => {
                // Call parent's onFieldChange so the table reflects changes immediately
                // This calls grid.markDirty on every keystroke → table updates live
                onFieldChange?.(rowId, field, value);
              }}
              onSave={(data) => onSave(rowId, data)}
            />
          )}
          {row && activeTab === TAB_ACTIVITY && (
            <ActivityTab
              rowId={rowId}
              comments={row._comments ?? []}
              canComment={canComment}
              {...(onAddComment !== undefined && { onAddComment })}
            />
          )}
          {row &&
            activeTab === TAB_ATTACHMENTS &&
            (row?._new ? (
              <div className="rf-flex rf-flex-col rf-items-center text-rf-text-3 rf-gap-3 pt-10">
                <FileCheck className="w-10 h-10 opacity-30" />
                <span className="text-[13px]">
                  Save the record to upload files
                </span>
              </div>
            ) : (
              <AttachmentsTab
                rowId={rowId}
                attachments={loadedAttachments ?? row._attachments ?? []}
                isLoading={attachmentsLoading}
                canUploadFiles={canUploadFiles}
                allowMultipleFileUpload={allowMultipleFileUpload}
                pendingUploads={pendingUploads.filter((p) => p.rowId === rowId)}
                onRetryUpload={handleRetryUpload}
                onDismissUpload={handleDismissUpload}
                {...(onUploadFile !== undefined && {
                  onUploadFile: handleAttachmentUpload,
                })}
                {...(onDeleteAttachment !== undefined && {
                  onDeleteAttachment: handleAttachmentDelete,
                })}
                {...(renderAttachment !== undefined && { renderAttachment })}
              />
            ))}
          {row && activeCustomTab && tabContext && (
            // Keyed by tab + record so a custom tab starts fresh for each row,
            // matching DetailsTab's key={rowId} remount contract above.
            <div key={`${activeCustomTab.id}:${rowId}`}>
              {activeCustomTab.render(tabContext)}
            </div>
          )}
          {!row && (
            <div className="rf-flex rf-flex-col rf-items-center text-rf-text-3 rf-gap-3 pt-10">
              <FileCheck className="w-10 h-10 opacity-30" />
              <span className="text-[13px]">Select a row to view details</span>
            </div>
          )}
        </div>

        {/* PANEL FOOTER — always visible at bottom, never scrolls away.
            Shown on Details, and on any custom tab opting in via showFooter. */}
        {row && (activeTab === TAB_DETAILS || activeCustomTab?.showFooter) && (
          <div
            className="rf-flex-shrink-0 rf-flex rf-gap-2 px-4 py-3 border-t border-rf-border bg-rf-surface"
            style={{ boxShadow: "0 -4px 12px rgba(15,23,42,.06)" }}
          >
            {canEdit && canSave && !editLocked ? (
              (() => {
                const isSavingRow = !!row._saving;
                return (
                  <>
                    {/* On Details this submits DetailsTab's RHF form. On a
                        custom tab that form is not mounted, so a submit button
                        would silently do nothing — save the draft directly
                        instead. Validation still runs: markDirty validated each
                        field into _errors, and saveRow checks it. */}
                    <button
                      {...(activeCustomTab
                        ? {
                            type: "button" as const,
                            onClick: () =>
                              onSave(
                                rowId,
                                (row._draft as Record<string, unknown>) ?? {},
                              ),
                          }
                        : {
                            type: "submit" as const,
                            form: `rf-details-form-${rowId}`,
                          })}
                      disabled={isSavingRow}
                      className="rf-flex-1 rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 py-2.5 text-[13px] rf-font-semibold rounded-rf-md bg-rf-accent text-white border border-rf-accent hover:bg-rf-accent-hover rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      {isSavingRow ? (
                        <>
                          <Spinner size={14} />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="rf-icon-sm" /> Save Changes
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingRow}
                      onClick={() => {
                        onDiscard(rowId);
                        setResetKey((k) => k + 1);
                      }}
                      className="rf-inline-flex rf-items-center rf-justify-center rf-gap-1.5 px-4 py-2.5 text-[13px] rf-font-medium rounded-rf-md bg-rf-surface text-rf-text-2 border border-rf-border hover:bg-rf-header rf-transition-colors disabled:rf-opacity-60 disabled:rf-cursor-not-allowed"
                    >
                      <RotateCcw className="rf-icon-sm" /> Discard
                    </button>
                  </>
                );
              })()
            ) : (
              <div className="rf-flex-1 rf-flex rf-items-center rf-justify-center rf-gap-2 py-2 text-[12.5px] text-rf-text-3">
                <Lock className="rf-icon-sm" />
                {editLocked
                  ? "Editing is locked — unlock it from the toolbar"
                  : !canEdit
                    ? "Read-only — you do not have edit permission"
                    : "Saving is disabled"}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
