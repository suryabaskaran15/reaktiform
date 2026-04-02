import { cn, formatDate } from "../../utils";
import { ProgressBar } from "../primitives";
import { Badge } from "../primitives/Badge";
import type { ColumnDef } from "../../types";

type ComputedCellProps = {
  value: unknown;
  colDef: ColumnDef;
  className?: string;
};

export function ComputedCell({ value, colDef, className }: ComputedCellProps) {
  const isEmpty = value === null || value === undefined || value === "";

  const renderValue = () => {
    if (isEmpty) {
      return <span className="text-[12px] text-rf-text-3 italic">—</span>;
    }

    // Number with progress bar (e.g. completion %)
    if (colDef.type === "number" && colDef.suffix === "%") {
      return <ProgressBar value={Number(value)} />;
    }

    // Number
    if (colDef.type === "number") {
      const formatted =
        colDef.decimals !== undefined
          ? Number(value).toFixed(colDef.decimals)
          : String(value);
      return (
        <span className="font-mono text-[12.5px] text-rf-text-1">
          {colDef.prefix}
          {formatted}
          {colDef.suffix}
        </span>
      );
    }

    // Date
    if (colDef.type === "date") {
      return (
        <span className="font-mono text-[12.5px] text-rf-text-1">
          {formatDate(String(value))}
        </span>
      );
    }

    // Boolean
    if (typeof value === "boolean") {
      return (
        <Badge
          label={value ? "Yes" : "No"}
          variant={value ? "success" : "default"}
        />
      );
    }

    // Default — string
    return (
      <span
        className="text-[13px] text-rf-text-1 truncate"
        title={String(value)}
      >
        {String(value)}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "flex items-center px-[10px] h-full min-w-0 select-none",
        colDef.type === "number" && colDef.suffix === "%" && "px-[10px]",
        className,
      )}
      title="Computed — read only"
    >
      {renderValue()}
    </div>
  );
}
