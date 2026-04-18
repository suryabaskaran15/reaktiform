import { cn } from "../../utils";
import type { SelectOption } from "../../types";

// ─────────────────────────────────────────────────────────────
//  BADGE VARIANT SYSTEM
//  Supports both named semantic colors AND arbitrary CSS color strings.
//
//  Named variants map to CSS variables so they respect dark mode.
//  Custom hex/rgb/hsl strings are applied directly as inline styles.
// ─────────────────────────────────────────────────────────────

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "purple";

const NAMED_VARIANTS = new Set<BadgeVariant>([
  "default",
  "success",
  "warning",
  "error",
  "info",
  "purple",
]);

function isNamedVariant(color: string): color is BadgeVariant {
  return NAMED_VARIANTS.has(color as BadgeVariant);
}

// Named variant → Tailwind class sets (scoped via [data-reaktiform])
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-rf-header text-rf-text-2 border-rf-border",
  success: "bg-rf-ok-bg text-green-700 border-rf-ok-br",
  warning: "bg-rf-warn-bg text-amber-800 border-rf-warn-br",
  error: "bg-rf-err-bg text-red-800 border-rf-err-br",
  info: "bg-rf-accent-bg text-blue-900 border-rf-accent-br",
  purple: "bg-rf-purple-bg text-purple-800 border-rf-purple-br",
};

const dotClasses: Record<BadgeVariant, string> = {
  default: "bg-rf-text-3",
  success: "bg-rf-ok",
  warning: "bg-rf-warn",
  error: "bg-rf-err",
  info: "bg-rf-accent",
  purple: "bg-rf-purple",
};

// ─────────────────────────────────────────────────────────────
//  BADGE COMPONENT
// ─────────────────────────────────────────────────────────────
type BadgeProps = {
  label: string;
  /**
   * Named variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'
   * Custom color:  Any CSS color string — '#FF5733', 'rgb(255,87,51)', 'hsl(11,100%,60%)'
   */
  variant?: string;
  showDot?: boolean;
  className?: string | undefined;
};

export function Badge({
  label,
  variant = "default",
  showDot = true,
  className,
}: BadgeProps) {
  // Named variant — use Tailwind classes + CSS vars (dark mode safe)
  if (isNamedVariant(variant)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold",
          "px-2 py-[2px] rounded-full border whitespace-nowrap",
          variantClasses[variant],
          className,
        )}
      >
        {showDot && (
          <span
            className={cn(
              "w-[5px] h-[5px] rounded-full flex-shrink-0",
              dotClasses[variant],
            )}
          />
        )}
        {label}
      </span>
    );
  }

  // Custom color — use inline styles so any CSS color works
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        "px-2 py-[2px] rounded-full border whitespace-nowrap",
        className,
      )}
      style={{
        backgroundColor: `${variant}22`, // 13% opacity background
        borderColor: `${variant}55`, // 33% opacity border
        color: variant, // solid text color
      }}
    >
      {showDot && (
        <span
          className="w-[5px] h-[5px] rounded-full flex-shrink-0"
          style={{ backgroundColor: variant }}
        />
      )}
      {label}
    </span>
  );
}

// ── Helper: map SelectOption.color → badge variant
export function getOptionVariant(color: SelectOption["color"]): string {
  if (!color) return "default";
  // Named variants pass through; custom colors pass through too
  return color;
}

// ── Helper: render a select option as a badge
export function OptionBadge({
  option,
  className,
}: {
  option: SelectOption;
  className?: string;
}) {
  return (
    <Badge
      label={option.label}
      variant={getOptionVariant(option.color)}
      {...(className !== undefined && { className })}
    />
  );
}
