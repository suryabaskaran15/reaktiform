import type { SyntheticEvent } from "react";
import { Calendar } from "lucide-react";
import { cn, resolveConstraint } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase, inputError } from "../FormField";
import type { ColumnDef, Row } from "../../../types";

// ─────────────────────────────────────────────────────────────
// FORMATTED DATE FIELD — used instead of the plain DateField whenever
// col.format is set (see DetailsTab.tsx's switch). Exactly ONE visible box
// at all times: the formatted text. The real native <input type="date"> is
// layered directly on top of it (`opacity: 0`, same size) rather than
// shown in a separate popup — clicking anywhere in the box hits the real
// input and calls showPicker() to open the BROWSER's own native calendar,
// which is entirely browser-managed (its own position, its own dismissal).
// This is the same "invisible native control over a custom visual" trick
// used across the web for custom-styled checkboxes/file inputs. No portal,
// no backdrop, no positioning math — the field's own box never changes
// shape, and only one input-shaped box is ever on screen for this field.
//
// Deliberately picker-only, not typable: a native input can never show OUR
// custom format while actively being typed into (100% browser-rendered) —
// making it typable would mean showing raw mm/dd/yyyy the moment you focus
// it, which is exactly the problem this component exists to prevent. See
// the plan file / session history for the tried-and-rejected alternative
// (reveal-on-focus) — real typing support would require a fully custom
// masked text input parsing a declared, structured date format, which
// col.format (an arbitrary function) cannot generically provide.
// ─────────────────────────────────────────────────────────────
export function FormattedDateField<TData>({
  col,
  k,
  err,
  rowForConstraint,
  onFieldChange,
  currentVal,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  rowForConstraint: Row<TData>;
  onFieldChange: (field: string, value: unknown) => void;
  currentVal: unknown;
}) {
  const formatted = col.format!(currentVal, rowForConstraint);

  const openPicker = (e: SyntheticEvent<HTMLInputElement>) => {
    // Best-effort — not every browser supports showPicker() yet. Without
    // it the input is still fully present and focusable, just invisible;
    // same graceful-degradation stance as the grid's DateCellEdit, which
    // relies on the same API on the same click/focus events.
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // ignore
    }
  };

  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      fullRow={isPanelFieldFullRow(col)}
    >
      <div style={{ position: "relative" }}>
        <div
          aria-hidden="true"
          className={cn(
            inputBase,
            "text-left flex items-center gap-1.5",
            err && inputError,
          )}
          style={{ pointerEvents: "none" }}
        >
          <span className="flex-1 truncate">{formatted}</span>
          <Calendar className="rf-icon-sm text-rf-text-3 shrink-0" />
        </div>
        <input
          value={typeof currentVal === "string" ? currentVal : ""}
          type="date"
          {...(col.minDate !== undefined && {
            min: resolveConstraint(col.minDate, rowForConstraint),
          })}
          {...(col.maxDate !== undefined && {
            max: resolveConstraint(col.maxDate, rowForConstraint),
          })}
          aria-label={`${col.label}: ${formatted}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
          }}
          onClick={openPicker}
          onFocus={openPicker}
          onChange={(e) => {
            onFieldChange(k, e.target.value ?? "");
          }}
        />
      </div>
    </FormField>
  );
}
