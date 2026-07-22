import type { UseFormRegister } from "react-hook-form";
import { cn, resolveConstraint } from "../../../utils";
import { FormField, inputBase, inputError } from "../FormField";
import type { ColumnDef, Row } from "../../../types";

export function NumberField<TData>({
  col,
  k,
  err,
  register,
  rowForConstraint,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  register: UseFormRegister<Record<string, unknown>>;
  rowForConstraint: Row<TData>;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      className="rf-col-span-1"
    >
      {/* Wrapper positions prefix/suffix absolutely inside the input box */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        {col.prefix && (
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: "var(--rf-text-3)",
              pointerEvents: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
              lineHeight: 1,
            }}
          >
            {col.prefix}
          </span>
        )}
        <input
          {...register(k, { valueAsNumber: true })}
          type="number"
          {...(col.min !== undefined && {
            min: resolveConstraint(col.min, rowForConstraint),
          })}
          {...(col.max !== undefined && {
            max: resolveConstraint(col.max, rowForConstraint),
          })}
          placeholder="0"
          style={{
            paddingLeft: col.prefix
              ? `${col.prefix.length * 8 + 14}px`
              : undefined,
            paddingRight: col.suffix
              ? `${col.suffix.length * 8 + 10}px`
              : undefined,
          }}
          className={cn(
            inputBase,
            err && inputError,
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
          onChange={(e) => {
            onFieldChange(k, e.target.valueAsNumber);
          }}
        />
        {col.suffix && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: "var(--rf-text-3)",
              pointerEvents: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
              lineHeight: 1,
            }}
          >
            {col.suffix}
          </span>
        )}
      </div>
    </FormField>
  );
}
