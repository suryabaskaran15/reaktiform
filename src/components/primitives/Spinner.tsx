type SpinnerProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function Spinner({ size = 14, strokeWidth = 3, className }: SpinnerProps) {
  return (
    <svg
      className={className}
      style={{
        width: size,
        height: size,
        animation: "rf-spin 0.8s linear infinite",
        flexShrink: 0,
      }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray="32"
        strokeDashoffset="12"
        strokeLinecap="round"
      />
    </svg>
  );
}
