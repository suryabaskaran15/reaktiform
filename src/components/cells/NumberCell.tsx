import { useRef, useEffect } from "react";
import { cn } from "../../utils";
import { ProgressBar } from "../primitives/ProgressBar";

// ── READ MODE
type NumberCellReadProps = {
  value: number | null | undefined;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  showProgress?: boolean; // true for completion % columns
  className?: string;
};

export function NumberCellRead({
  value,
  suffix,
  prefix,
  decimals,
  showProgress = false,
  className,
}: NumberCellReadProps) {
  const isEmpty = value === null || value === undefined;

  if (showProgress && !isEmpty) {
    const p = Number(value);
    return (
      <div
        className={cn("flex items-center px-[10px] h-full w-full", className)}
      >
        <ProgressBar value={p} />
      </div>
    );
  }

  const formatted = isEmpty
    ? null
    : decimals !== undefined
      ? Number(value).toFixed(decimals)
      : String(value);

  return (
    <div className={cn("flex items-center px-[10px] h-full", className)}>
      {isEmpty ? (
        <span className="text-[12px] text-rf-text-3 italic">—</span>
      ) : (
        <span className="font-mono text-[12.5px] text-rf-text-1">
          {prefix}
          {formatted}
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── EDIT MODE
type NumberCellEditProps = {
  value: number | null | undefined;
  min?: number | undefined;
  max?: number | undefined;
  decimals?: number | undefined;
  suffix?: string | undefined;
  prefix?: string | undefined;
  autoFocus?: boolean;
  onCommit: (value: number | null) => void;
  onCancel: () => void;
  className?: string | undefined;
};

export function NumberCellEdit({
  value,
  min,
  max,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: NumberCellEditProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [autoFocus]);

  const commit = () => {
    const raw = ref.current?.value;
    if (raw === "" || raw === undefined) {
      onCommit(null);
      return;
    }
    const n = parseFloat(raw);
    onCommit(isNaN(n) ? null : n);
  };

  return (
    <input
      ref={ref}
      type="number"
      defaultValue={value ?? ""}
      min={min}
      max={max}
      className={cn(
        "w-full h-full border-none outline-none bg-transparent",
        "font-mono text-[13px] text-rf-text-1 px-[10px]",
        "placeholder:text-rf-text-3",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          commit();
        }
      }}
      onBlur={commit}
    />
  );
}
