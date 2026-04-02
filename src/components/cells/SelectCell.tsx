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
//  READ MODE
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
//  SHARED STYLES
// ─────────────────────────────────────────────────────────────
function makeSelectStyles<IsMulti extends boolean>(): StylesConfig<
  SelectOption,
  IsMulti,
  GroupBase<SelectOption>
> {
  return {
    container: (base) => ({ ...base, width: "100%" }),
    control: (base, state) => ({
      ...base,
      minHeight: 30,
      height: 30,
      border: `1.5px solid ${state.isFocused ? "var(--rf-accent)" : "var(--rf-border)"}`,
      boxShadow: state.isFocused ? "0 0 0 3px rgba(59,91,219,.12)" : "none",
      borderRadius: 6,
      background: "var(--rf-bg)",
      cursor: "pointer",
      flexWrap: "nowrap",
      "&:hover": { borderColor: "var(--rf-accent)" },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 8px",
      flexWrap: "nowrap",
      overflow: "hidden",
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: "var(--rf-text-1)",
      fontFamily: "var(--rf-font-sans)",
      fontSize: 12.5,
    }),
    singleValue: (base) => ({
      ...base,
      color: "var(--rf-text-1)",
      fontFamily: "var(--rf-font-sans)",
      fontSize: 12.5,
    }),
    placeholder: (base) => ({
      ...base,
      color: "var(--rf-text-3)",
      fontSize: 12,
      fontStyle: "italic",
    }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: "0 6px",
      color: "var(--rf-text-3)",
    }),
    clearIndicator: (base) => ({
      ...base,
      padding: "0 4px",
      color: "var(--rf-text-3)",
      "&:hover": { color: "var(--rf-err)" },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      border: "1px solid var(--rf-border)",
      boxShadow: "0 8px 32px rgba(15,23,42,.16)",
      borderRadius: 10,
      background: "var(--rf-surface)",
      overflow: "hidden",
      marginTop: 2,
    }),
    menuList: (base) => ({ ...base, padding: "4px 0" }),
    option: (base, state) => ({
      ...base,
      padding: "7px 10px",
      fontSize: 12.5,
      cursor: "pointer",
      background: state.isSelected
        ? "var(--rf-accent-bg)"
        : state.isFocused
          ? "var(--rf-row-hover)"
          : "transparent",
      color: state.isSelected ? "var(--rf-accent)" : "var(--rf-text-1)",
    }),
    multiValue: (base) => ({
      ...base,
      background: "var(--rf-accent-bg)",
      borderRadius: 100,
      border: "1px solid var(--rf-accent-br)",
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: "var(--rf-accent)",
      fontSize: 11,
      fontWeight: 600,
      padding: "1px 6px",
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: "var(--rf-accent)",
      borderRadius: "0 100px 100px 0",
      "&:hover": { background: "var(--rf-err-bg)", color: "var(--rf-err)" },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: 12.5,
      color: "var(--rf-text-3)",
    }),
    loadingMessage: (base) => ({
      ...base,
      fontSize: 12.5,
      color: "var(--rf-text-3)",
    }),
  };
}

// ─────────────────────────────────────────────────────────────
//  CUSTOM OPTION — renders badge if option has color
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
        }}
      >
        {opt.color ? (
          <OptionBadge option={opt} />
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--rf-text-1)" }}>
            {opt.label}
          </span>
        )}
        {props.isSelected && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--rf-accent)"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </components.Option>
  );
}

// ─────────────────────────────────────────────────────────────
//  COMMON PROPS — shared across all select variants
// ─────────────────────────────────────────────────────────────
const COMMON_PROPS = {
  menuPortalTarget: typeof document !== "undefined" ? document.body : null,
  menuPosition: "fixed" as const,
  menuShouldScrollIntoView: false,
  classNamePrefix: "rf-rs",
  components: { Option: CustomOption as never },
};

// ─────────────────────────────────────────────────────────────
//  SINGLE SELECT — EDIT MODE
//  Supports: static options, async loading, creatable, or both
// ─────────────────────────────────────────────────────────────
type SelectCellEditProps = {
  value: string | null | undefined;
  options?: SelectOption[];
  searchable?: boolean;
  isClearable?: boolean;
  // Async
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  // Creatable
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

export function SelectCellEdit({
  value,
  options = [],
  searchable,
  isClearable = false,
  loadOptions,
  onCreateOption,
  onCommit,
  onCancel,
}: SelectCellEditProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  const styles = makeSelectStyles<false>();

  const commonProps = {
    ...COMMON_PROPS,
    autoFocus: true,
    openMenuOnFocus: true,
    menuIsOpen: true,
    isClearable,
    isSearchable: searchable ?? (!!loadOptions || options.length > 6),
    placeholder: "Select…",
    styles,
    value: selected,
    defaultOptions: options,
    onChange: (opt: SingleValue<SelectOption>) => {
      if (opt) onCommit(opt.value);
      else onCancel();
    },
    onMenuClose: onCancel,
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

  // Both async + creatable
  if (loadOptions && onCreateOption) {
    return wrap(
      <AsyncCreatableSelect<SelectOption, false>
        {...commonProps}
        loadOptions={loadOptions}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          onCommit(created.value);
        }}
      />,
    );
  }

  // Async only
  if (loadOptions) {
    return wrap(
      <AsyncSelect<SelectOption, false>
        {...commonProps}
        loadOptions={loadOptions}
      />,
    );
  }

  // Creatable only
  if (onCreateOption) {
    return wrap(
      <CreatableSelect<SelectOption, false>
        {...commonProps}
        options={options}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          onCommit(created.value);
        }}
      />,
    );
  }

  // Static only (default)
  return wrap(
    <ReactSelect<SelectOption, false> {...commonProps} options={options} />,
  );
}

// ─────────────────────────────────────────────────────────────
//  MULTI SELECT OVERLAY — used by MultiSelectCellEdit
//  Supports: static options, async loading, creatable, or both
// ─────────────────────────────────────────────────────────────
type SelectOverlayProps = {
  options: SelectOption[];
  selected: string[];
  multi?: boolean;
  searchable?: boolean;
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onSelect: (value: string) => void;
  onClose: () => void;
  referenceEl: HTMLElement | null;
};

export function SelectOverlay({
  options,
  selected,
  multi = false,
  searchable,
  loadOptions,
  onCreateOption,
  onSelect,
  onClose,
}: SelectOverlayProps) {
  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const styles = makeSelectStyles<true>();

  const handleMultiChange = useCallback(
    (vals: MultiValue<SelectOption>) => {
      const newVals = vals.map((v) => v.value);
      const added = newVals.find((v) => !selected.includes(v));
      const removed = selected.find((v) => !newVals.includes(v));
      if (added) onSelect(added);
      if (removed) onSelect(removed);
    },
    [selected, onSelect],
  );

  const commonProps = {
    ...COMMON_PROPS,
    autoFocus: true,
    openMenuOnFocus: true,
    menuIsOpen: true,
    isSearchable: searchable ?? (!!loadOptions || options.length > 6),
    placeholder: "Select…",
    styles,
    defaultOptions: options,
    onMenuClose: onClose,
  };

  const wrap = (children: React.ReactNode) => (
    <div style={{ padding: "0 2px", width: "100%" }}>{children}</div>
  );

  if (!multi) {
    return wrap(
      <ReactSelect<SelectOption, false>
        {...COMMON_PROPS}
        autoFocus
        openMenuOnFocus
        menuIsOpen
        isSearchable={searchable ?? options.length > 6}
        placeholder="Select…"
        styles={makeSelectStyles<false>()}
        value={selectedOptions[0] ?? null}
        options={options}
        onChange={(opt: SingleValue<SelectOption>) => {
          if (opt) {
            onSelect(opt.value);
            onClose();
          }
        }}
        onMenuClose={onClose}
      />,
    );
  }

  if (loadOptions && onCreateOption) {
    return wrap(
      <AsyncCreatableSelect<SelectOption, true>
        {...commonProps}
        isMulti
        value={selectedOptions}
        loadOptions={loadOptions}
        onChange={handleMultiChange}
        onCreateOption={async (input) => {
          const created = await onCreateOption(input);
          onSelect(created.value);
        }}
      />,
    );
  }

  if (loadOptions) {
    return wrap(
      <AsyncSelect<SelectOption, true>
        {...commonProps}
        isMulti
        value={selectedOptions}
        loadOptions={loadOptions}
        onChange={handleMultiChange}
      />,
    );
  }

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
          onSelect(created.value);
        }}
      />,
    );
  }

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
