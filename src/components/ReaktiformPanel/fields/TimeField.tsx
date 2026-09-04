import type { UseFormRegister } from "react-hook-form";
import { cn } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase, inputError} from "../FormField";
import type { ColumnDef } from "../../../types";

export function TimeField<TData>({
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
      fullRow={isPanelFieldFullRow(col)}
    >
      <input
        {...register(k)}
        type="time"
        className={cn(inputBase, "font-mono", err && inputError)}
        onChange={(e) => {
          onFieldChange(k, e.target.value ?? "");
        }}
      />
    </FormField>
  );
}
