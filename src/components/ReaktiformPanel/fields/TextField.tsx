import type { UseFormRegister } from "react-hook-form";
import { cn } from "../../../utils";
import { FormField, inputBase, inputError } from "../FormField";
import type { ColumnDef } from "../../../types";

export function TextField<TData>({
  col,
  k,
  err,
  register,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  register: UseFormRegister<Record<string, unknown>>;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      className="rf-col-span-2"
    >
      {col.multiline ? (
        <textarea
          {...register(k)}
          rows={col.rows ?? 3}
          placeholder={`Enter ${col.label.toLowerCase()}…`}
          className={cn(inputBase, "resize-y min-h-[70px]", err && inputError)}
          onChange={(e) => {
            onFieldChange(k, e.target.value);
          }}
        />
      ) : (
        <input
          {...register(k)}
          type="text"
          placeholder={`Enter ${col.label.toLowerCase()}…`}
          className={cn(inputBase, err && inputError)}
          onChange={(e) => {
            onFieldChange(k, e.target.value);
          }}
        />
      )}
    </FormField>
  );
}
