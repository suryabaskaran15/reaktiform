import  { useRef, useEffect } from "react";
import { cn } from "../../utils";
import { formatDate, getDaysFromToday } from "../../utils";

// ── READ MODE
type DateCellReadProps = {
  value: string | null | undefined;
  dateFormat?: string;
  placeholder?: string;
  className?: string;
};

export function DateCellRead({
  value,
  placeholder = "Pick date…",
  className,
}: DateCellReadProps) {
  if (!value) {
    return (
      <div className={cn("flex items-center px-[10px] h-full", className)}>
        <span className="text-[12px] text-rf-text-3 italic">{placeholder}</span>
      </div>
    );
  }

  const days = getDaysFromToday(value);
  const colorClass =
    days < 0 ? "text-rf-err" : days < 7 ? "text-rf-warn" : "text-rf-text-1";

  return (
    <div className={cn("flex items-center px-[10px] h-full", className)}>
      <span className={cn("text-[12.5px] font-mono", colorClass)}>
        {formatDate(value)}
      </span>
    </div>
  );
}

// ── EDIT MODE
type DateCellEditProps = {
  value: string | null | undefined;
  minDate?: string;
  maxDate?: string;
  autoFocus?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
};

export function DateCellEdit({
  value,
  minDate,
  maxDate,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: DateCellEditProps) {
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false); // guard against onChange + onBlur double-fire

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (autoFocus) {
      el.focus();
      // showPicker() opens the native calendar popup.
      // Must be inside requestAnimationFrame — browser requires a user-gesture
      // context, and rAF fires after mount when that condition is met.
      requestAnimationFrame(() => {
        try {
          el.showPicker?.();
        } catch {}
      });
    }
  }, [autoFocus]);

  function commit(v: string) {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(v);
  }

  return (
    <input
      ref={ref}
      type="date"
      defaultValue={value ?? ""}
      min={minDate}
      max={maxDate}
      className={cn(
        "w-full h-full border-none outline-none bg-transparent",
        "font-mono text-[12.5px] text-rf-text-1 px-[10px] cursor-pointer",
        className,
      )}
      onClick={() => {
        committedRef.current = false; // reset so next pick can commit
        try {
          ref.current?.showPicker?.();
        } catch {}
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          commit(ref.current?.value ?? "");
        }
      }}
      onChange={(e) => {
        // Fires when user picks from the calendar popup — commit immediately
        if (e.target.value) commit(e.target.value);
      }}
      onBlur={(e) => {
        // Fallback for keyboard entry — commit on blur if not already committed
        commit(e.target.value);
      }}
    />
  );
}
