import { RichTextEditor } from "../../richtext/RichTextEditor";
import { FormField, isPanelFieldFullRow} from "../FormField";
import type { ColumnDef } from "../../../types";

// Controlled by the row value like every other panel field (see
// DetailsTab.tsx). RichTextEditor syncs external value changes itself
// (getHTML() comparison, emitUpdate: false), so undo/inline edits show here.
// Commits on every keystroke (no buffering): unlike the grid's popover,
// there's no per-keystroke undo-history/markDirty cost here — see
// onFieldChange's own live-typing-updates-grid wiring in ReaktiformPanel.tsx.
export function RichTextField<TData>({
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
      <RichTextEditor
        value={typeof value === "string" ? value : ""}
        onChange={(html) => {
          onFieldChange(k, html);
        }}
        minHeight={col.minHeight ?? 220}
        error={!!err}
        resizable
        {...(col.placeholder !== undefined && {
          placeholder: col.placeholder,
        })}
      />
    </FormField>
  );
}
