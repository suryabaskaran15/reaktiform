import { Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { RichTextEditor } from "../../richtext/RichTextEditor";
import { FormField, isPanelFieldFullRow} from "../FormField";
import type { ColumnDef } from "../../../types";

// register() only binds native form elements — Tiptap's contentEditable
// surface isn't one, so this uses Controller+control like SelectField.tsx.
// Commits on every keystroke (no buffering): unlike the grid's popover,
// there's no per-keystroke undo-history/markDirty cost here — see
// onFieldChange's own live-typing-updates-grid wiring in ReaktiformPanel.tsx.
export function RichTextField<TData>({
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
  return (
    <FormField
      key={k}
      label={col.label}
      required={col.required}
      error={err}
      fullRow={isPanelFieldFullRow(col)}
    >
      <Controller
        name={k}
        control={control}
        render={({ field }) => (
          <RichTextEditor
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(html) => {
              field.onChange(html);
              onFieldChange(k, html);
            }}
            minHeight={col.minHeight ?? 220}
            error={!!err}
            resizable
            {...(col.placeholder !== undefined && {
              placeholder: col.placeholder,
            })}
          />
        )}
      />
    </FormField>
  );
}
