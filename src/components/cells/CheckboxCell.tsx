import { cn } from "../../utils";

type CheckboxCellProps = {
  value: boolean | null | undefined;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  className?: string;
};

export function CheckboxCell({
  value,
  disabled = false,
  onChange,
  className,
}: CheckboxCellProps) {
  return (
    <div className={cn("flex items-center justify-center h-full", className)}>
      <input
        type="checkbox"
        checked={!!value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "w-[14px] h-[14px] rounded-[3px] cursor-pointer",
          "accent-[var(--rf-accent)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        // Stop click from bubbling to row (which would activate edit mode)
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
