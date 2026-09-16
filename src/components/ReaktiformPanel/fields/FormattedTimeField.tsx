import type { UseFormRegister } from "react-hook-form";
import type { SyntheticEvent } from "react";
import { cn } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase, inputError } from "../FormField";
import type { ColumnDef, Row } from "../../../types";

// ─────────────────────────────────────────────────────────────
// FORMATTED TIME FIELD — the time-type counterpart to FormattedDateField.
// See that file's header comment for the full rationale; kept as a
// separate, parallel file rather than a shared base, matching how the
// plain DateField/TimeField are also two independent files today.
// ─────────────────────────────────────────────────────────────
export function FormattedTimeField<TData>({
  col,
  k,
  err,
  register,
  rowForConstraint,
  onFieldChange,
  currentVal,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  register: UseFormRegister<Record<string, unknown>>;
  rowForConstraint: Row<TData>;
  onFieldChange: (field: string, value: unknown) => void;
  currentVal: unknown;
}) {
  const formatted = col.format!(currentVal, rowForConstraint);
  const timeRegister = register(k);

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
          className={cn(inputBase, "text-left", err && inputError)}
          style={{ pointerEvents: "none" }}
        >
          {formatted}
        </div>
        <input
          {...timeRegister}
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
