import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Palette, X } from "lucide-react";
import { cn } from "../../utils";
import { useAnchoredPosition } from "./useAnchoredPosition";
import { CF_COLORS, getCFOps, buildCFColors } from "./cfHelpers";
import { CFConditionValueInput } from "./CFConditionValueInput";
import type { ColumnDef, CFRule, CFCondition } from "../../types";

// ─────────────────────────────────────────────────────────────
//  CFPanel
// ─────────────────────────────────────────────────────────────
export function CFPanel({
  columns,
  rules,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
  anchor,
  isDark,
}: {
  columns: ColumnDef[];
  rules: CFRule[];
  onAddRule: () => void;
  onUpdateRule: (id: string, updates: Partial<CFRule>) => void;
  onDeleteRule: (id: string) => void;
  onClose: () => void;
  anchor?: DOMRect | null;
  isDark: boolean;
}) {
  const inp = cn(
    "px-2 py-1 text-[12px] border border-rf-border rounded-rf-md",
    "bg-rf-bg text-rf-text-1 outline-none focus:border-rf-accent",
  );

  const CF_PANEL_W = 520;
  const CF_PANEL_H = Math.min(560, window.innerHeight * 0.82);
  const panelPos = useAnchoredPosition(anchor ?? null, CF_PANEL_W, CF_PANEL_H);

  const updateCond = (
    rule: CFRule,
    ci: number,
    patch: Partial<{ field: string; op: string; value: string }>,
  ) => {
    const conds = rule.conditions.map((c, i) =>
      i === ci ? { ...c, ...patch } : c,
    ) as CFCondition[];
    onUpdateRule(rule.id, { conditions: conds });
  };

  // ── Inline style tokens — themed via the data-reaktiform scope applied
  // to this panel's portal root below (light/dark resolved by CSS var).
  const S = {
    surface: "var(--rf-surface)",
    header: "var(--rf-header)",
    bg: "var(--rf-bg)",
    border: "var(--rf-border)",
    text1: "var(--rf-text-1)",
    text2: "var(--rf-text-2)",
    text3: "var(--rf-text-3)",
    accent: "var(--rf-accent)",
    accentBg: "var(--rf-accent-bg)",
    accentBr: "var(--rf-accent-br)",
    err: "var(--rf-err)",
    errBg: "var(--rf-err-bg)",
    purple: "var(--rf-purple)",
    radiusMd: "7px",
    radiusLg: "10px",
  };
  const inpStyle: CSSProperties = {
    padding: "4px 8px",
    fontSize: 12,
    border: `1px solid ${S.border}`,
    borderRadius: S.radiusMd,
    background: S.bg,
    color: S.text1,
    outline: "none",
    fontFamily: "Inter, system-ui, sans-serif",
    transition: "border-color 120ms",
  };

  return createPortal(
    <div
      data-reaktiform
      className={cn(isDark && "dark")}
      style={{ position: "fixed", inset: 0, zIndex: 900 }}
      onClick={onClose}
    >
      <div
        style={{
          ...panelPos,
          width: CF_PANEL_W,
          maxHeight: CF_PANEL_H,
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: S.radiusLg,
          boxShadow: "0 8px 40px rgba(15,23,42,.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "Inter, system-ui, sans-serif",
          zIndex: 901,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 16px",
            borderBottom: `1px solid ${S.border}`,
            background: S.header,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Palette style={{ width: 15, height: 15, color: S.purple }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: S.text1 }}>
              Conditional Formatting
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: S.text3,
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>

        {/* ── Rules list — scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {rules.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                fontSize: 12.5,
                color: S.text3,
                fontStyle: "italic",
              }}
            >
              No rules yet. Add a rule to highlight rows based on conditions.
            </div>
          )}

          {rules.map((rule) => (
            <div
              key={rule.id}
              style={{
                border: `1px solid ${S.border}`,
                borderRadius: S.radiusLg,
                padding: 12,
                background: S.bg,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* ── Rule name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { enabled: e.target.checked })
                  }
                  style={{
                    width: 13,
                    height: 13,
                    accentColor: S.accent,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <input
                  value={rule.label}
                  onChange={(e) =>
                    onUpdateRule(rule.id, { label: e.target.value })
                  }
                  placeholder="Rule name…"
                  style={{ ...inpStyle, flex: 1 }}
                />
                <select
                  value={rule.logic}
                  onChange={(e) =>
                    onUpdateRule(rule.id, {
                      logic: e.target.value as "AND" | "OR",
                    })
                  }
                  style={{ ...inpStyle, paddingRight: 4 }}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: S.text3,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = S.err;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      S.errBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      S.text3;
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {/* ── Conditions */}
              {rule.conditions.map((cond, ci) => {
                const col = columns.find(
                  (c) => (c.key as string) === cond.field,
                );
                const ops = getCFOps(col?.type);
                const safeOp = ops.find((o) => o.value === cond.op)
                  ? cond.op
                  : (ops[0]?.value ?? "eq");

                return (
                  <div
                    key={ci}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Field */}
                    <select
                      style={{ ...inpStyle, flex: 1, minWidth: 110 }}
                      value={cond.field}
                      onChange={(e) => {
                        const newCol = columns.find(
                          (c) => (c.key as string) === e.target.value,
                        );
                        const newOps = getCFOps(newCol?.type);
                        const newOp = newOps[0]?.value ?? "eq";
                        updateCond(rule, ci, {
                          field: e.target.value,
                          op: newOp as string,
                          value: "",
                        });
                      }}
                    >
                      {columns
                        .filter((c) => !c.computed)
                        .map((c) => (
                          <option key={c.key as string} value={c.key as string}>
                            {c.label}
                          </option>
                        ))}
                    </select>

                    {/* Operator */}
                    <select
                      style={{ ...inpStyle, minWidth: 100 }}
                      value={safeOp}
                      onChange={(e) =>
                        updateCond(rule, ci, { op: e.target.value, value: "" })
                      }
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {/* Smart value input */}
                    <CFConditionValueInput
                      col={col}
                      op={safeOp}
                      value={cond.value}
                      onChange={(v) => updateCond(rule, ci, { value: v })}
                      inp={inp}
                    />

                    {/* Remove */}
                    {rule.conditions.length > 1 && (
                      <button
                        onClick={() =>
                          onUpdateRule(rule.id, {
                            conditions: rule.conditions.filter(
                              (_, i) => i !== ci,
                            ),
                          })
                        }
                        style={{
                          width: 22,
                          height: 22,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: S.text3,
                          borderRadius: 4,
                          marginTop: 2,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            S.err)
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.color =
                            S.text3)
                        }
                      >
                        <X style={{ width: 11, height: 11 }} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* ── Add condition link */}
              <button
                onClick={() =>
                  onUpdateRule(rule.id, {
                    conditions: [
                      ...rule.conditions,
                      {
                        field:
                          (columns.find((c) => !c.computed)?.key as string) ??
                          "",
                        op: "eq",
                        value: "",
                      },
                    ],
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11.5,
                  color: S.accent,
                  padding: 0,
                  textAlign: "left",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                + Add condition
              </button>

              {/* ── Color picker section */}
              <div
                style={{
                  paddingTop: 10,
                  borderTop: `1px solid ${S.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: S.text3,
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}
                >
                  Highlight color
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Preset swatches */}
                  {CF_COLORS.map((preset) => {
                    const active = rule.backgroundColor === preset.bg;
                    return (
                      <button
                        key={preset.label}
                        title={preset.label}
                        onClick={() =>
                          onUpdateRule(rule.id, {
                            backgroundColor: preset.bg,
                            textColor: preset.text,
                          })
                        }
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          cursor: "pointer",
                          background: preset.bg,
                          border: `2px solid ${active ? S.accent : preset.bg}`,
                          boxShadow: active
                            ? `0 0 0 2px ${S.accentBr}`
                            : "inset 0 0 0 1px rgba(0,0,0,.12)",
                          transform: active ? "scale(1.2)" : "scale(1)",
                          transition: "all 120ms ease",
                        }}
                      />
                    );
                  })}

                  {/* Separator */}
                  <div
                    style={{
                      width: 1,
                      height: 20,
                      background: S.border,
                      flexShrink: 0,
                    }}
                  />

                  {/* Custom color picker */}
                  <label
                    title="Pick custom color — auto-converted to a light pastel"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      cursor: "pointer",
                      border: `2px dashed ${S.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                      background: !CF_COLORS.some(
                        (p) => p.bg === rule.backgroundColor,
                      )
                        ? rule.backgroundColor
                        : S.header,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: S.text3,
                        lineHeight: 1,
                        userSelect: "none",
                      }}
                    >
                      ✎
                    </span>
                    <input
                      type="color"
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                        width: "100%",
                        height: "100%",
                      }}
                      value={
                        rule.backgroundColor.startsWith("#") &&
                        rule.backgroundColor.length === 7
                          ? rule.backgroundColor
                          : "#EEF2FF"
                      }
                      onChange={(e) => {
                        const { bg, text } = buildCFColors(e.target.value);
                        onUpdateRule(rule.id, {
                          backgroundColor: bg,
                          textColor: text,
                        });
                      }}
                    />
                  </label>

                  {/* Live preview */}
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, color: S.text3 }}>
                      Preview:
                    </span>
                    <div
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: rule.backgroundColor,
                        color: rule.textColor,
                        border: `1px solid ${rule.backgroundColor}`,
                        boxShadow: "0 1px 3px rgba(0,0,0,.08)",
                      }}
                    >
                      Row highlight
                    </div>
                  </div>
                </div>

                {/* Custom hex info */}
                {!CF_COLORS.some((p) => p.bg === rule.backgroundColor) && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 11, color: S.text3 }}>
                      Custom:
                    </span>
                    <code
                      style={{
                        fontSize: 11,
                        fontFamily: "JetBrains Mono, Fira Code, monospace",
                        background: S.header,
                        borderRadius: 4,
                        padding: "2px 6px",
                        color: S.text2,
                        border: `1px solid ${S.border}`,
                      }}
                    >
                      bg: {rule.backgroundColor} · text: {rule.textColor}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 16px",
            borderTop: `1px solid ${S.border}`,
            background: S.header,
          }}
        >
          <button
            onClick={onAddRule}
            style={{
              width: "100%",
              padding: "8px 0",
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: S.radiusMd,
              border: `2px dashed ${S.border}`,
              background: "transparent",
              color: S.text2,
              cursor: "pointer",
              fontFamily: "Inter, system-ui, sans-serif",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = S.accent;
              b.style.color = S.accent;
              b.style.background = S.accentBg;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = S.border;
              b.style.color = S.text2;
              b.style.background = "transparent";
            }}
          >
            + Add Rule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
