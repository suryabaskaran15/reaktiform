import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../utils";

// ─────────────────────────────────────────────────────────────
//  SHARED STYLES
//  Use rf-input / rf-input-error CSS classes defined in reaktiform.css
//  instead of Tailwind utility strings — these survive any consumer reset.
// ─────────────────────────────────────────────────────────────
export const inputBase = "rf-input";
export const inputError = "rf-input-error";

// ─────────────────────────────────────────────────────────────
//  FORM FIELD WRAPPER
// ─────────────────────────────────────────────────────────────
export function FormField({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("mb-3", className)}>
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
