import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { FormField } from "../FormField";
import type { ColumnDef } from "../../../types";

export function RatingField<TData>({
  col,
  k,
  err,
  control,
  onFieldChange,
}: {
  col: ColumnDef<TData>;
  k: string;
  err: string | undefined;
  control: Control<Record<string, unknown>>;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  const maxStars = col.ratingMax ?? 5;

  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      className="rf-col-span-1"
    >
      <Controller
        name={k}
        control={control}
        render={({ field }) => {
          const rating = Math.round(Number(field.value ?? 0));
          return (
            <div className="rf-flex rf-items-center rf-gap-0.5">
              {Array.from({ length: maxStars }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const next = rating === i + 1 ? 0 : i + 1;
                    field.onChange(next);
                    onFieldChange(k, next);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 1px",
                    fontSize: 18,
                    lineHeight: 1,
                    color: i < rating ? "#F59E0B" : "var(--rf-border)",
                    transition: "color 100ms",
                  }}
                  title={`Rate ${i + 1} of ${maxStars}`}
                >
                  ★
                </button>
              ))}
            </div>
          );
        }}
      />
    </FormField>
  );
}
