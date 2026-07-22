import type { UseFormRegister } from "react-hook-form";
import { cn } from "../../../utils";
import { FormField, inputBase } from "../FormField";
import type { ColumnDef } from "../../../types";

export function CheckboxField<TData>({
  col,
  k,
  register,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  register: UseFormRegister<Record<string, unknown>>;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  return (
    <FormField key={k} label={col.label} className="rf-col-span-1">
      <div className={cn(inputBase, "flex items-center gap-2 cursor-pointer")}>
        <input
          {...register(k)}
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
