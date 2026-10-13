import type { SyntheticEvent } from "react";
import { Clock } from "lucide-react";
import { cn } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase, inputError } from "../FormField";
import type { ColumnDef, Row } from "../../../types";

// ─────────────────────────────────────────────────────────────
// FORMATTED TIME FIELD — the time-type counterpart to FormattedDateField.
// See that file's header comment for the full rationale (formatted at all
// times, picker-only rather than typable — see that comment for why
// typing isn't supported); kept as a separate, parallel file rather than a
// shared base, matching how the plain DateField/TimeField are also two
// independent files today.
// ─────────────────────────────────────────────────────────────
export function FormattedTimeField<TData>({
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
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // ignore — input remains usable without the forced picker
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
          <Clock className="rf-icon-sm text-rf-text-3 shrink-0" />
        </div>
        <input
          value={typeof currentVal === "string" ? currentVal : ""}
          type="time"
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
