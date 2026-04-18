import { useRef } from "react";
import type { SelectOption } from "../../types";
import { cn } from "../../utils";
import { SelectOverlay } from "./SelectCell";

// ─────────────────────────────────────────────────────────────
//  TAG PILL — read mode display for each selected value
// ─────────────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  default: "bg-rf-header text-rf-text-2 border-rf-border",
  success: "bg-rf-ok-bg text-green-700 border-rf-ok-br",
  warning: "bg-rf-warn-bg text-amber-800 border-rf-warn-br",
  error: "bg-rf-err-bg text-red-800 border-rf-err-br",
  info: "bg-rf-accent-bg text-blue-900 border-rf-accent-br",
  purple: "bg-rf-purple-bg text-purple-800 border-rf-purple-br",
};

function TagPill({ option }: { option: SelectOption }) {
  const colorClass =
    TAG_COLORS[option.color ?? "default"] ?? TAG_COLORS["default"]!;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10.5px] font-medium px-[6px] py-[1px] rounded-full border whitespace-nowrap flex-shrink-0",
        colorClass,
      )}
    >
      {option.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  READ MODE
// ─────────────────────────────────────────────────────────────
type MultiSelectCellReadProps = {
  value: string[] | null | undefined;
  options?: SelectOption[];
  maxVisible?: number;
  placeholder?: string;
  className?: string | undefined;
};

export function MultiSelectCellRead({
  value,
  options,
  maxVisible = 2,
  placeholder = "Add tags…",
  className,
}: MultiSelectCellReadProps) {
  if (!value || value.length === 0) {
    return (
      <div className={cn("flex items-center px-2 h-full", className)}>
        <span className="text-[12px] text-rf-text-3 italic">{placeholder}</span>
      </div>
    );
  }

  const visible = value.slice(0, maxVisible);
  const overflow = value.length - maxVisible;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 h-full overflow-hidden",
        className,
      )}
    >
      {visible.map((val) => {
        const opt = options?.find((o) => o.value === val);
        return opt ? (
          <TagPill key={val} option={opt} />
        ) : (
          <span
            key={val}
            className="inline-flex text-[10.5px] font-medium px-1.5 py-[1px] rounded-full border border-rf-border bg-rf-header text-rf-text-2 whitespace-nowrap flex-shrink-0"
          >
            {val}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-[10.5px] text-rf-text-3 font-medium flex-shrink-0">
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  EDIT MODE — uses React Select via SelectOverlay
// ─────────────────────────────────────────────────────────────
type MultiSelectCellEditProps = {
  value: string[] | null | undefined;
  options: SelectOption[];
  searchable?: boolean;
  isClearable?: boolean; // controlled by col.clearable
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onCommit: (value: string[]) => void;
  onCancel: () => void;
};

export function MultiSelectCellEdit({
  value,
  options,
  searchable,
  isClearable = false,
  loadOptions,
  onCreateOption,
  onCommit,
  onCancel,
}: MultiSelectCellEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isAsync = !!loadOptions;

  // For async multiselect: stored value is SelectOption[] ({ value, label }[]).
  // For static multiselect: stored value is string[].
  // Normalise to SelectOption[] for SelectOverlay in both cases.
  const currentOpts: SelectOption[] = isAsync
    ? Array.isArray(value)
      ? (value as unknown as SelectOption[]).filter(
          (v): v is SelectOption =>
            v != null && typeof v === "object" && "value" in v,
        )
      : []
    : Array.isArray(value)
      ? (value as string[]).map(
          (id) =>
            options.find((o) => o.value === id) ?? { value: id, label: id },
        )
      : [];

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <SelectOverlay
        options={options}
        selectedOptions={currentOpts}
        multi={true}
        searchable={searchable ?? (isAsync || options.length > 6)}
        isClearable={isClearable}
        onCommitMulti={(opts) => {
          // Async: commit SelectOption[] so labels are preserved for display.
          // Static: commit string[] (id values only) — unchanged behaviour.
          if (isAsync) {
            onCommit(opts as unknown as string[]);
          } else {
            onCommit(opts.map((o) => o.value));
          }
        }}
        onClose={onCancel}
        referenceEl={ref.current}
        {...(loadOptions !== undefined && { loadOptions })}
        {...(onCreateOption !== undefined && { onCreateOption })}
      />
    </div>
  );
}
