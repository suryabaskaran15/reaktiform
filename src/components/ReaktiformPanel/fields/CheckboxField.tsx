import { cn } from "../../../utils";
import { FormField, isPanelFieldFullRow, inputBase} from "../FormField";
import type { ColumnDef } from "../../../types";

export function CheckboxField<TData>({
  col,
  k,
  value,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  value: unknown;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  return (
    <FormField key={k} label={col.label} fullRow={isPanelFieldFullRow(col)}>
      <div className={cn(inputBase, "flex items-center gap-2 cursor-pointer")}>
        <input
          checked={!!value}
          type="checkbox"
          id={`form-${k}`}
          className="w-[14px] h-[14px] rounded-[3px] accent-[var(--rf-accent)] rf-cursor-pointer"
          onChange={(e) => {
            onFieldChange(k, e.target.checked);
          }}
        />
        <label
          htmlFor={`form-${k}`}
          className="text-[13px] text-rf-text-1 rf-cursor-pointer rf-font-medium"
        >
          {col.label}
        </label>
      </div>
    </FormField>
  );
}
