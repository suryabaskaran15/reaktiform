import type { UseFormRegister } from "react-hook-form";
import { cn, resolveConstraint } from "../../../utils";
import { FormField, inputBase, inputError } from "../FormField";
import type { ColumnDef, Row } from "../../../types";

export function DateField<TData>({
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
      <input
        {...register(k)}
        type="date"
        {...(col.minDate !== undefined && {
          min: resolveConstraint(col.minDate, rowForConstraint),
        })}
        {...(col.maxDate !== undefined && {
          max: resolveConstraint(col.maxDate, rowForConstraint),
        })}
        className={cn(inputBase, "font-mono", err && inputError)}
        onChange={(e) => {
          onFieldChange(k, e.target.value || null);
        }}
      />
    </FormField>
  );
}
