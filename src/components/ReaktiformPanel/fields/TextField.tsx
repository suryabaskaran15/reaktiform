import { cn } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase, inputError} from "../FormField";
import type { ColumnDef } from "../../../types";

export function TextField<TData>({
  col,
  k,
  err,
  value,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  value: unknown;
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
      {col.multiline ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          rows={col.rows ?? 3}
          placeholder={`Enter ${col.label.toLowerCase()}…`}
          className={cn(inputBase, "resize-y min-h-[70px]", err && inputError)}
          onChange={(e) => {
            onFieldChange(k, e.target.value);
          }}
        />
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
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
