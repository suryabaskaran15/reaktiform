import { useRef, useEffect, useLayoutEffect } from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "../../utils";
import { formatDate, formatTime } from "../../utils";

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

  // const days = getDaysFromToday(value);
  // const colorClass =
  //   days < 0 ? "text-rf-err" : days < 7 ? "text-rf-warn" : "text-rf-text-1";

  return (
    <div className={cn("flex items-center px-[10px] h-full", className)}>
      <span className={cn("text-[12.5px] font-mono")}>{formatDate(value)}</span>
    </div>
  );
}

// ── EDIT MODE
type DateCellEditProps = {
  value: string | null | undefined;
  /**
   * Display text shown while editing — either `colDef.format`'s output or
   * reaktiform's own default `formatDate()`, computed by CellRenderer.tsx.
   * The real input is invisible (see the header comment below), so this is
   * the only thing actually visible in the cell while it's being edited.
   */
  formatted: string;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  autoFocus?: boolean | undefined;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
};

// The real native <input type="date"> is layered `opacity: 0` directly on
// top of a decorative box showing `formatted` — the same "invisible native
// control over a custom visual" technique used for the panel's
// FormattedDateField (src/components/ReaktiformPanel/fields/). This is what
// lets an editing cell show `colDef.format`'s output (or reaktiform's own
// default) instead of the browser's raw mm/dd/yyyy: clicking anywhere in
// the cell hits the real (invisible) input and calls showPicker() to open
// the browser's own native calendar, which is entirely browser-managed.
//
// Deliberately picker-only, not typable — a native input can never show OUR
// format while actively being typed into (100% browser-rendered), so making
// it typable would mean showing raw mm/dd/yyyy the moment it's focused,
// which is exactly what this component exists to prevent. (A reveal-on-
// focus variant was tried and rejected for exactly that reason — see
// session history / the plan file.)
export function DateCellEdit({
  value,
  formatted,
  minDate,
  maxDate,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: DateCellEditProps) {
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false); // guard against onChange + onBlur double-fire

  // useLayoutEffect (not useEffect) for the focus() call only — fires before
  // paint, avoiding a brief unfocused flash between mount and focus. The
  // showPicker() call stays deferred via requestAnimationFrame exactly as
  // before — it requires an active user-gesture context, unrelated to paint
  // timing, and moving focus() earlier doesn't change that.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (autoFocus) {
      el.focus();
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
    <div className={cn("relative w-full h-full", className)}>
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 h-full px-[10px] pointer-events-none font-mono text-[12.5px] text-rf-text-1"
      >
        <span className="flex-1 truncate">{formatted}</span>
        <Calendar className="rf-icon-sm text-rf-text-3 shrink-0" />
      </div>
      <input
        ref={ref}
        type="date"
        defaultValue={value ?? ""}
        min={minDate}
        max={maxDate}
        aria-label={formatted}
        className="absolute inset-0 w-full h-full border-none outline-none opacity-0 cursor-pointer"
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
    </div>
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

  const formatted = formatTime(value);

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
  /** See DateCellEdit's `formatted` prop comment — same contract. */
  formatted: string;
  autoFocus?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
};

// See DateCellEdit's header comment — same invisible-overlay technique.
export function TimeCellEdit({
  value,
  formatted,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: TimeCellEditProps) {
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  // useLayoutEffect for the same reason as DateCellEdit above.
  useLayoutEffect(() => {
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
    <div className={cn("relative w-full h-full", className)}>
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 h-full px-[10px] pointer-events-none font-mono text-[12.5px] text-rf-text-1"
      >
        <span className="flex-1 truncate">{formatted}</span>
        <Clock className="rf-icon-sm text-rf-text-3 shrink-0" />
      </div>
      <input
        ref={ref}
        type="time"
        defaultValue={value ?? ""}
        aria-label={formatted}
        className="absolute inset-0 w-full h-full border-none outline-none opacity-0 cursor-pointer"
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
    </div>
  );
}
