import { cn } from "../../utils";

type ProgressBarProps = {
  value: number; // 0–100
  showLabel?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  showLabel = true,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const fillClass =
    pct >= 70 ? "bg-rf-ok" : pct >= 40 ? "bg-rf-warn" : "bg-rf-err";

  return (
    <div className={cn("flex items-center gap-2 w-full", className)}>
      <div className="flex-1 h-[4px] bg-rf-border rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            fillClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-mono text-rf-text-2 w-7 text-right flex-shrink-0">
          {pct}%
        </span>
      )}
    </div>
  );
}
