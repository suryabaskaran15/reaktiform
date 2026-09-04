import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../utils";
import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  SHARED STYLES
//  Use rf-input / rf-input-error CSS classes defined in reaktiform.css
//  instead of Tailwind utility strings — these survive any consumer reset.
// ─────────────────────────────────────────────────────────────
export const inputBase = "rf-input";
export const inputError = "rf-input-error";

// ─────────────────────────────────────────────────────────────
//  FIELD SPAN
// ─────────────────────────────────────────────────────────────
/**
 * Whether a field takes a whole row in the panel's responsive field grid
 * (1/2/3 columns, sized to the form in `DetailsTab`).
 *
 * Single source of truth — every field component and every inline `FormField`
 * in `DetailsTab` routes through here, so the rule can never drift between
 * the twelve places that used to hardcode it.
 *
 * Returns a boolean rather than a class name deliberately: `FormField` applies
 * it as an inline `grid-column`, so the layout can't be broken by a consumer
 * loading a stale `reaktiform.css` that predates the rule.
 */
export function isPanelFieldFullRow<TData>(col: ColumnDef<TData>): boolean {
  // richtext and textarea are ALWAYS full row, whatever `isFullRow` says — a
  // WYSIWYG toolbar or a multi-line editor in a third of a row is unusable.
  // `isFullRow` is an opt-IN for the other types, never an opt-out for these.
  return (
    col.type === "richtext" ||
    (col.type === "text" && !!col.multiline) ||
    !!col.isFullRow
  );
}

// ─────────────────────────────────────────────────────────────
//  FORM FIELD WRAPPER
// ─────────────────────────────────────────────────────────────
export function FormField({
  label,
  required,
  error,
  children,
  className,
  fullRow,
}: {
  label: string;
  required?: boolean | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** Span every column of the field grid. See {@link isPanelFieldFullRow}. */
  fullRow?: boolean | undefined;
}) {
  return (
    <div
      className={cn("mb-3", className)}
      // `1 / -1` spans whatever the current column count is. NOT `span 2` —
      // at three columns that would leave a dangling third cell.
      style={fullRow ? { gridColumn: "1 / -1" } : undefined}
    >
      <label className="rf-flex rf-items-center rf-gap-1 text-[11px] rf-font-semibold text-rf-text-2 rf-uppercase tracking-[.04em] mb-1.5">
        {label}
        {required && <span className="text-rf-err rf-font-bold">*</span>}
      </label>
      {children}
      {error && (
        <div className="rf-flex rf-items-center rf-gap-1 mt-1 text-[11px] text-rf-err">
          <AlertCircle className="w-[11px] h-[11px] rf-flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
