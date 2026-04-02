import { useRef } from "react";
import { cn } from "../../utils";
import { SelectOverlay } from "./SelectCell";
import type { SelectOption } from "../../types";

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
  loadOptions?: (input: string) => Promise<SelectOption[]>;
  onCreateOption?: (input: string) => Promise<SelectOption> | SelectOption;
  onCommit: (value: string[]) => void;
  onCancel: () => void;
};

export function MultiSelectCellEdit({
  value,
  options,
  searchable,
  loadOptions,
  onCreateOption,
  onCommit,
  onCancel,
}: MultiSelectCellEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const current = value ?? [];

  const handleSelect = (optValue: string) => {
    const updated = current.includes(optValue)
      ? current.filter((v) => v !== optValue)
      : [...current, optValue];
    onCommit(updated);
  };

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <SelectOverlay
        options={options}
        selected={current}
        multi={true}
        searchable={searchable ?? options.length > 6}
        onSelect={handleSelect}
        onClose={onCancel}
        referenceEl={ref.current}
        {...(loadOptions !== undefined && { loadOptions })}
        {...(onCreateOption !== undefined && { onCreateOption })}
      />
    </div>
  );
}
