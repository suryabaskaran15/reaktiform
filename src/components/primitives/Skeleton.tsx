import { cn } from "../../utils";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  rounded?: "sm" | "md" | "full";
  className?: string;
};

const ROUNDED_CLASS: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  sm: "rounded-rf-sm",
  md: "rounded-rf-md",
  full: "rounded-full",
};

export function Skeleton({ width, height = 14, rounded = "sm", className }: SkeletonProps) {
  return (
    <div
      className={cn("rf-skeleton bg-rf-border", ROUNDED_CLASS[rounded], className)}
      style={{ width, height, animation: "rf-shimmer 1.5s ease-in-out infinite" }}
    />
  );
}
