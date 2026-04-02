import { cn } from "../../utils";
import type { SelectOption } from "../../types";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "purple";

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

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
  className?: string | undefined;
};

export function Badge({
  label,
  variant = "default",
  showDot = true,
  className,
}: BadgeProps) {
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

// ── Helper: get variant from SelectOption color
export function getOptionVariant(color: SelectOption["color"]): BadgeVariant {
  switch (color) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "error";
    case "info":
      return "info";
    case "purple":
      return "purple";
    default:
      return "default";
  }
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
