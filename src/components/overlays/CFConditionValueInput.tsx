import { cn, resolveConstraint } from "../../utils";
import type { ColumnDef, Row } from "../../types";

// ─────────────────────────────────────────────────────────────
//  SMART CONDITION VALUE INPUT
//  Renders the right input control based on field type + operator
// ─────────────────────────────────────────────────────────────
export function CFConditionValueInput({
  col,
  op,
  value,
  onChange,
  inp,
}: {
  col: ColumnDef | undefined;
  op: string;
  value: string;
  onChange: (v: string) => void;
  inp: string;
}) {
  const type = col?.type;

  // select/multiselect/badge + eq/neq → dropdown of options
  if (
    (type === "select" || type === "multiselect" || type === "badge") &&
    (op === "eq" || op === "neq") &&
    col?.options?.length
  ) {
    return (
      <select
        className={cn(inp, "flex-1 min-w-[80px]")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— any —</option>
        {col.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // select/multiselect + "is one of" → multi-checkbox list
  if (
    (type === "select" || type === "multiselect" || type === "badge") &&
    op === "in" &&
    col?.options?.length
  ) {
    const selected = value
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const toggle = (v: string) => {
      const next = selected.includes(v)
        ? selected.filter((s) => s !== v)
        : [...selected, v];
      onChange(next.join(","));
    };
    return (
      <div className="rf-flex-wrap rf-gap-1 rf-flex-1">
        {col.options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 20,
                padding: "2px 8px",
                border: "1px solid",
                background: isSel ? "var(--rf-accent)" : "var(--rf-header)",
                color: isSel ? "#fff" : "var(--rf-text-2)",
                borderColor: isSel ? "var(--rf-accent)" : "var(--rf-border)",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // checkbox → Yes / No buttons
  if (type === "checkbox") {
    return (
      <div className="rf-flex rf-gap-1 rf-flex-1">
        {["true", "false"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              flex: 1,
              padding: "2px 0",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: "1px solid",
              background:
                value === v ? "var(--rf-accent)" : "var(--rf-surface)",
              color: value === v ? "#fff" : "var(--rf-text-2)",
              borderColor:
                value === v ? "var(--rf-accent)" : "var(--rf-border)",
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            {v === "true" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }

  // date → date input
  if (type === "date") {
    return (
      <input
        type="date"
        className={cn(inp, "flex-1")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // number-like → number input with optional min/max
  // resolveConstraint resolves static values and calls function constraints
  // with an empty row (CF condition inputs have no row context).
  if (
    ["number", "currency", "percentage", "rating", "progress"].includes(
      type ?? "",
    )
  ) {
    const resolvedMin =
      col?.min !== undefined
        ? resolveConstraint(col.min, {} as Row<Record<string, unknown>>)
        : undefined;
    const resolvedMax =
      col?.max !== undefined
        ? resolveConstraint(col.max, {} as Row<Record<string, unknown>>)
        : undefined;
    return (
      <input
        type="number"
        className={cn(inp, "flex-1")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        {...(resolvedMin !== undefined && { min: resolvedMin })}
        {...(resolvedMax !== undefined && { max: resolvedMax })}
      />
    );
  }

  // default → text input
  return (
    <input
      type="text"
      className={cn(inp, "flex-1")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value…"
    />
  );
}
