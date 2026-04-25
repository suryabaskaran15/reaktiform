import { useRef, useEffect } from "react";
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
  minDate?: string | undefined;
  maxDate?: string | undefined;
  autoFocus?: boolean | undefined;
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

  // Sync min/max attributes when dynamic constraints change (cross-field deps).
  // e.g. rfqDate changes → prDate's minDate prop updates → this effect fires
  // and updates the native input's min attribute without remounting the cell.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (minDate !== undefined) el.min = minDate;
    else el.removeAttribute("min");
  }, [minDate]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (maxDate !== undefined) el.max = maxDate;
    else el.removeAttribute("max");
  }, [maxDate]);

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
        // Fires when user picks from the calendar popup — commit + blur to close picker
        if (e.target.value) {
          commit(e.target.value);
          // Blur the input to close the native date picker popup.
          // Without this the popup stays open after the user selects a date.
          requestAnimationFrame(() => {
            ref.current?.blur();
          });
        }
      }}
      onBlur={(e) => {
        // Fallback for keyboard entry — commit on blur if not already committed
        commit(e.target.value);
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
//  TIME CELL — stores value as "HH:MM" (24-hour ISO time string)
// ─────────────────────────────────────────────────────────────

// ── READ MODE
type TimeCellReadProps = {
  value: string | null | undefined;
  placeholder?: string;
  className?: string;
};

export function TimeCellRead({
  value,
  placeholder = "Pick time…",
  className,
}: TimeCellReadProps) {
  if (!value) {
    return (
      <div
        className={cn("rf-flex rf-items-center px-[10px] rf-h-full", className)}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--rf-text-3)",
            fontStyle: "italic",
          }}
        >
          {placeholder}
        </span>
      </div>
    );
  }

  // Format "HH:MM" → "HH:MM AM/PM" for display
  const [h, m] = value.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour = (h ?? 0) % 12 || 12;
  const formatted = `${String(hour).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;

  return (
    <div
      className={cn("rf-flex rf-items-center px-[10px] rf-h-full", className)}
    >
      <span
        style={{
          fontSize: 12.5,
          fontFamily: "monospace",
          color: "var(--rf-text-1)",
        }}
      >
        {formatted}
      </span>
    </div>
  );
}

// ── EDIT MODE
type TimeCellEditProps = {
  value: string | null | undefined;
  autoFocus?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
};

export function TimeCellEdit({
  value,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: TimeCellEditProps) {
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      requestAnimationFrame(() => {
        try {
          ref.current?.showPicker?.();
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
      type="time"
      defaultValue={value ?? ""}
      className={cn(
        "w-full h-full border-none outline-none bg-transparent",
        "font-mono text-[12.5px] text-rf-text-1 px-[10px] cursor-pointer",
        className,
      )}
      onClick={() => {
        committedRef.current = false;
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
        if (e.target.value) {
          commit(e.target.value);
          requestAnimationFrame(() => {
            ref.current?.blur();
          });
        }
      }}
      onBlur={(e) => {
        commit(e.target.value);
      }}
    />
  );
}
