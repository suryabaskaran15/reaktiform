import { cn } from "../../utils";

type ProgressBarProps = {
  value: number; // 0–100
  showLabel?: boolean;
  className?: string;
  /** "status" (default) colors by threshold like a health meter. "accent" is a flat brand-colored fill, correct for things like upload progress where a low value isn't "bad". */
  tone?: "status" | "accent";
  /** Renders an infinitely-sliding bar instead of a fixed-width fill. Ignores `value` and hides the label. */
  indeterminate?: boolean;
};

export function ProgressBar({
  value,
  showLabel = true,
  className,
  tone = "status",
  indeterminate = false,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const fillClass =
    tone === "accent"
      ? "bg-rf-accent"
      : pct >= 70
        ? "bg-rf-ok"
        : pct >= 40
          ? "bg-rf-warn"
          : "bg-rf-err";

  return (
    <div className={cn("flex items-center gap-2 w-full", className)}>
      <div className="flex-1 h-[4px] bg-rf-border rounded-full overflow-hidden">
        {indeterminate ? (
          <div
            className="h-full w-1/3 rounded-full bg-rf-accent"
            style={{ animation: "rf-progress-indeterminate 1.1s ease-in-out infinite" }}
          />
        ) : (
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              fillClass,
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {showLabel && !indeterminate && (
        <span className="text-[11px] font-mono text-rf-text-2 w-7 text-right flex-shrink-0">
          {pct}%
        </span>
      )}
    </div>
  );
}
