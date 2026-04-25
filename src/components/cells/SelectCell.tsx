import React, { useCallback } from "react";
import ReactSelect, {
  components,
  type StylesConfig,
  type SingleValue,
  type MultiValue,
  type GroupBase,
} from "react-select";
import AsyncSelect from "react-select/async";
import CreatableSelect from "react-select/creatable";
import AsyncCreatableSelect from "react-select/async-creatable";
import { cn } from "../../utils";
import { OptionBadge } from "../primitives/Badge";
import type { SelectOption } from "../../types";

// ─────────────────────────────────────────────────────────────
//  OPTION CACHE
//  Module-level cache keyed by loadOptions function reference.
//  Results survive across cell open/close cycles — every re-open
//  after the first is instant with zero API calls.
//  Invalidate after onCreateOption so new items appear next open.
// ─────────────────────────────────────────────────────────────
type LoadOptionsFn = (input: string) => Promise<SelectOption[]>;
const optionCache = new Map<LoadOptionsFn, Map<string, SelectOption[]>>();

export function cachedLoadOptions(fn: LoadOptionsFn): LoadOptionsFn {
  return async (input: string): Promise<SelectOption[]> => {
    let fnCache = optionCache.get(fn);
    if (!fnCache) {
      fnCache = new Map();
      optionCache.set(fn, fnCache);
    }
    const key = input.trim().toLowerCase();
    if (fnCache.has(key)) return fnCache.get(key)!;
    const results = await fn(input);
    fnCache.set(key, results);
    return results;
  };
}

export function invalidateLoadOptionsCache(fn: LoadOptionsFn): void {
  optionCache.delete(fn);
}

// ─────────────────────────────────────────────────────────────
//  DESIGN TOKENS
//  Hardcoded — menus render in document.body where [data-reaktiform]
//  CSS variables are not inherited.
// ─────────────────────────────────────────────────────────────
const T = {
  surface: "#FFFFFF",
  bg: "#F4F6FA",
  border: "#E2E5ED",
  text1: "#0F172A",
  text2: "#475569",
  text3: "#94A3B8",
  accent: "#3B5BDB",
  accentBg: "#EEF2FF",
  accentBr: "#C7D2FE",
  rowHover: "#F8FAFF",
  err: "#DC2626",
  errBg: "#FFF1F2",
} as const;

// ─────────────────────────────────────────────────────────────
//  SHARED STYLES — single source of truth for all select variants
// ─────────────────────────────────────────────────────────────
function makeSelectStyles<IsMulti extends boolean>(
  compact = false,
): StylesConfig<SelectOption, IsMulti, GroupBase<SelectOption>> {
  return {
    container: (b) => ({ ...b, width: "100%" }),
    control: (b, s) => ({
      ...b,
      minHeight: compact ? 30 : 32,
      height: compact ? 30 : "auto",
      border: `1.5px solid ${s.isFocused ? T.accent : T.border}`,
      boxShadow: s.isFocused ? `0 0 0 3px rgba(59,91,219,.12)` : "none",
      borderRadius: 6,
      backgroundColor: T.bg, // explicit — overrides React Select's base bg
      cursor: "pointer",
      flexWrap: "wrap",
      "&:hover": { borderColor: T.accent },
    }),
    valueContainer: (b) => ({
      ...b,
      padding: compact ? "0 8px" : "2px 8px",
      flexWrap: "wrap",
      overflow: "visible",
      gap: 2,
    }),
    input: (b) => ({
      ...b,
      margin: 0,
      padding: 0,
      color: T.text1,
      fontSize: 12.5,
    }),
    singleValue: (b) => ({ ...b, color: T.text1, fontSize: 12.5 }),
    multiValue: (b) => ({
      ...b,
      backgroundColor: T.accentBg,
      borderRadius: 100,
      border: `1px solid ${T.accentBr}`,
      margin: "1px 2px",
    }),
    multiValueLabel: (b) => ({
      ...b,
      color: T.accent,
      fontSize: 11,
      fontWeight: 600,
      padding: "1px 6px",
    }),
    multiValueRemove: (b) => ({
      ...b,
      color: T.accent,
      borderRadius: "0 100px 100px 0",
      "&:hover": { backgroundColor: T.errBg, color: T.err },
    }),
    placeholder: (b) => ({
      ...b,
      color: T.text3,
      fontSize: 12,
      fontStyle: "italic",
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (b) => ({ ...b, padding: "0 6px", color: T.text3 }),
    clearIndicator: (b) => ({
      ...b,
      padding: "0 4px",
      color: T.text3,
      "&:hover": { color: T.err },
    }),
    // menuPortal must be highest z-index to escape table stacking context
    menuPortal: (b) => ({ ...b, zIndex: 9999, pointerEvents: "auto" }),
    menu: (_b) => ({
      // Don't spread _b — React Select's base menu styles interfere in production.
      // Define all properties we need explicitly.
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      border: `1px solid ${T.border}`,
      boxShadow: "0 8px 32px rgba(15,23,42,.18)",
      borderRadius: 10,
      backgroundColor: T.surface, // explicit white — always wins
      overflow: "hidden",
      marginTop: 4,
      minWidth: 160,
      zIndex: 1,
      boxSizing: "border-box",
    }),
    menuList: (b) => ({
      ...b,
      padding: "4px 0",
      maxHeight: 280,
      overflowY: "auto",
    }),
    option: (_b, s) => ({
      // Don't spread _b (base) — it contains backgroundColor that conflicts
      // with ours in production. We define all needed properties explicitly.
      padding: "7px 10px",
      fontSize: 12.5,
      cursor: "pointer",
      minHeight: 34,
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
      width: "100%",
      userSelect: "none",
      WebkitUserSelect: "none",
      // This is the key — explicit backgroundColor always wins over any class
      backgroundColor: s.isSelected
        ? T.accentBg
        : s.isFocused
          ? T.rowHover
          : "transparent",
      color: s.isSelected ? T.accent : T.text1,
    }),
    noOptionsMessage: (b) => ({
      ...b,
      fontSize: 12.5,
      color: T.text3,
      padding: "8px 10px",
    }),
    loadingMessage: (b) => ({
      ...b,
      fontSize: 12.5,
      color: T.text3,
      padding: "8px 10px",
    }),
  };
}

// ─────────────────────────────────────────────────────────────
//  CUSTOM OPTION — renders color badge if option.color is set
// ─────────────────────────────────────────────────────────────
function CustomOption(props: React.ComponentProps<typeof components.Option>) {
  const opt = props.data as SelectOption;
  return (
    <components.Option {...props}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {opt.color ? (
          <OptionBadge option={opt} />
        ) : (
          <span style={{ fontSize: 12.5, color: T.text1 }}>{opt.label}</span>
        )}
        {props.isSelected && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.accent}
            strokeWidth="2.5"
            style={{ flexShrink: 0, marginLeft: 6 }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </components.Option>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMMON PROPS — shared across all variants
// ─────────────────────────────────────────────────────────────
function getCommonProps(compact = false) {
  return {
    menuPortalTarget: typeof document !== "undefined" ? document.body : null,
    menuPosition: "fixed" as const,
    menuShouldScrollIntoView: false,
    classNamePrefix: "rf-rs",
    components: { Option: CustomOption as never },
    styles: makeSelectStyles(compact),
  };
}

// ─────────────────────────────────────────────────────────────
//  READ MODE — single select display
// ─────────────────────────────────────────────────────────────
type SelectCellReadProps = {
  value: string | null | undefined;
  options?: SelectOption[];
  placeholder?: string;
  className?: string | undefined;
};

export function SelectCellRead({
  value,
  options,
  placeholder = "Select…",
  className,
}: SelectCellReadProps) {
  const option = options?.find((o) => o.value === value);
  return (
    <div
      className={cn("flex items-center px-[10px] h-full min-w-0", className)}
    >
      {option ? (
        option.color ? (
          <OptionBadge option={option} />
        ) : (
          <span className="text-[13px] text-rf-text-1 truncate">
            {option.label}
          </span>
        )
      ) : value ? (
        <span className="text-[13px] text-rf-text-1 truncate">{value}</span>
      ) : (
        <span className="text-[12px] text-rf-text-3 italic">{placeholder}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SINGLE SELECT — EDIT MODE
//  Supports: static | async | creatable | async+creatable
//
//  isClearable (default false):
//    When true, renders an ✕ button letting the user remove the
//    current selection and set the field to null/empty.
//    Set via col.clearable in your column definition.
//
//  currentLabel:
//    The human-readable label for the currently selected value.
//    Required for async selects — since options=[] on mount,
//    React Select cannot look up the label from options[].
//    Without this, it would show the raw id (uuid) on edit open.
// ─────────────────────────────────────────────────────────────
type SelectCellEditProps = {
  value: string | null | undefined;
  currentLabel?: string | null;
  options?: SelectOption[];
  searchable?: boolean;
  isClearable?: boolean; // controlled by col.clearable prop
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onCommit: (value: string, label?: string) => void;
  onCancel: () => void;
};

export function SelectCellEdit({
  value,
  currentLabel,
  options = [],
  searchable,
  isClearable = false,
  loadOptions,
  onCreateOption,
  onCommit,
  onCancel,
}: SelectCellEditProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  const COMMON = getCommonProps();

  // For async: build the value prop from stored id + currentLabel
  // currentLabel prevents the raw uuid from showing in edit mode
  const asyncValue =
    loadOptions && value
      ? { value: String(value), label: currentLabel ?? String(value) }
      : selected;

  // Track whether the user committed a value (selected OR cleared).
  // onMenuClose should only call onCancel if nothing was committed —
  // otherwise clicking ✕ would close AND cancel instead of clearing.
  let committed = false;

  const commonProps = {
    ...COMMON,
    autoFocus: true,
    openMenuOnFocus: true,
    isClearable,
    isSearchable: searchable ?? (!!loadOptions || options.length > 6),
    placeholder: "Select…",
    value: loadOptions ? asyncValue : selected,
    defaultOptions: loadOptions ? true : options,
    cacheOptions: !!loadOptions,
    onChange: (opt: SingleValue<SelectOption>) => {
      committed = true;
      if (opt) {
        // User selected an option — commit value + label
        onCommit(opt.value, opt.label);
      } else {
        // User clicked ✕ to clear — commit empty string so field is cleared
        // onCommit('') signals "cleared" to CellRenderer which stores null
        onCommit("", undefined);
      }
    },
    // Only cancel (close without saving) when the user clicks outside
    // the dropdown without making a selection. If they already committed
    // (selected or cleared), onMenuClose is a no-op.
    onMenuClose: () => {
      if (!committed) onCancel();
    },
  };

  const wrap = (children: React.ReactNode) => (
    <div
      style={{ padding: "0 2px", width: "100%" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      {children}
    </div>
  );

  if (loadOptions && onCreateOption) {
    return wrap(
      <AsyncCreatableSelect<SelectOption, false>
        {...commonProps}
        defaultMenuIsOpen
        loadOptions={cachedLoadOptions(loadOptions)}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          invalidateLoadOptionsCache(loadOptions);
          onCommit(created.value, created.label);
        }}
      />,
    );
  }

  if (loadOptions) {
    return wrap(
      <AsyncSelect<SelectOption, false>
        {...commonProps}
        defaultMenuIsOpen
        loadOptions={cachedLoadOptions(loadOptions)}
      />,
    );
  }

  if (onCreateOption) {
    return wrap(
      <CreatableSelect<SelectOption, false>
        {...commonProps}
        defaultMenuIsOpen
        options={options}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          onCommit(created.value, created.label);
        }}
      />,
    );
  }

  return wrap(
    <ReactSelect<SelectOption, false>
      {...commonProps}
      defaultMenuIsOpen
      options={options}
    />,
  );
}

// ─────────────────────────────────────────────────────────────
//  MULTI SELECT OVERLAY — used by MultiSelectCellEdit
//  Supports: static | async | creatable | async+creatable
//
//  selectedOptions: SelectOption[] — normalised by the caller.
//    Static:  string[]    → caller maps to SelectOption[] via options[]
//    Async:   SelectOption[] passthrough (already full objects)
//
//  onCommitMulti: called with full SelectOption[] after every change.
//    Caller decides what to persist (string[] static, SelectOption[] async).
//
//  isClearable: when true shows the ✕ clear-all button.
// ─────────────────────────────────────────────────────────────
type SelectOverlayProps = {
  options: SelectOption[];
  selectedOptions: SelectOption[];
  multi?: boolean;
  searchable?: boolean;
  isClearable?: boolean;
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onCommitMulti: (opts: SelectOption[]) => void;
  onClose: () => void;
  referenceEl: HTMLElement | null;
};

export function SelectOverlay({
  options,
  selectedOptions,
  multi = false,
  searchable,
  isClearable = false,
  loadOptions,
  onCreateOption,
  onCommitMulti,
  onClose,
}: SelectOverlayProps) {
  const COMMON = getCommonProps();

  const handleMultiChange = useCallback(
    (vals: MultiValue<SelectOption>) => {
      onCommitMulti([...vals]);
    },
    [onCommitMulti],
  );

  const commonProps = {
    ...COMMON,
    autoFocus: true,
    openMenuOnFocus: true,
    menuIsOpen: true,
    isSearchable: searchable ?? (!!loadOptions || options.length > 6),
    placeholder: "Select…",
    isClearable,
    defaultOptions: loadOptions ? true : options,
    cacheOptions: !!loadOptions,
    onMenuClose: onClose,
  };

  const wrap = (children: React.ReactNode) => (
    <div style={{ padding: "0 2px", width: "100%" }}>{children}</div>
  );

  // ── Single (non-multi) mode
  if (!multi) {
    return wrap(
      <ReactSelect<SelectOption, false>
        {...COMMON}
        autoFocus
        openMenuOnFocus
        menuIsOpen
        isClearable={isClearable}
        isSearchable={searchable ?? options.length > 6}
        placeholder="Select…"
        value={selectedOptions[0] ?? null}
        options={options}
        onChange={(opt: SingleValue<SelectOption>) => {
          if (opt) {
            onCommitMulti([opt]);
            onClose();
          } else {
            onCommitMulti([]);
            onClose();
          }
        }}
        onMenuClose={onClose}
      />,
    );
  }

  // ── Async + Creatable
  if (loadOptions && onCreateOption) {
    return wrap(
      <AsyncCreatableSelect<SelectOption, true>
        {...commonProps}
        isMulti
        value={selectedOptions}
        loadOptions={cachedLoadOptions(loadOptions)}
        onChange={handleMultiChange}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          invalidateLoadOptionsCache(loadOptions);
          onCommitMulti([...selectedOptions, created]);
        }}
      />,
    );
  }

  // ── Async only
  if (loadOptions) {
    return wrap(
      <AsyncSelect<SelectOption, true>
        {...commonProps}
        isMulti
        value={selectedOptions}
        loadOptions={cachedLoadOptions(loadOptions)}
        onChange={handleMultiChange}
      />,
    );
  }

  // ── Creatable (static options)
  if (onCreateOption) {
    return wrap(
      <CreatableSelect<SelectOption, true>
        {...commonProps}
        isMulti
        value={selectedOptions}
        options={options}
        onChange={handleMultiChange}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          onCommitMulti([...selectedOptions, created]);
        }}
      />,
    );
  }

  // ── Static only (default)
  return wrap(
    <ReactSelect<SelectOption, true>
      {...commonProps}
      isMulti
      value={selectedOptions}
      options={options}
      onChange={handleMultiChange}
    />,
  );
}
