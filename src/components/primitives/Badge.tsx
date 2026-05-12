import React from "react";
import type { SelectOption } from "../../types";

// ─────────────────────────────────────────────────────────────
//  BADGE — fully inline styles, zero CSS class dependencies.
//
//  Works identically in:
//  • Grid cells (inside [data-reaktiform])
//  • React Select menus (portaled to document.body)
//  • Any consumer app with any CSS framework
//
//  THREE COLOR FORMATS:
//
//  1. Named token  — 'success' | 'warning' | 'error' | 'info' | 'purple' | 'default'
//     Uses our hardcoded design token palette.
//
//  2. CSS string   — '#E53E3E' | 'rgb(229,62,62)' | 'hsl(0,72%,51%)' | 'tomato'
//     Auto-derives a light background + border from the color,
//     and computes a legible text color via W3C luminance contrast.
//
//  3. Custom object — { bg?, text?, dot?, border? }
//     Full user control. Any omitted field is auto-derived from `bg`.
//     Example: { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626' }
// ─────────────────────────────────────────────────────────────

// ── Named semantic tokens ──────────────────────────────────────
type NamedVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "purple";

const NAMED: Set<NamedVariant> = new Set([
  "default",
  "success",
  "warning",
  "error",
  "info",
  "purple",
]);

type TokenSet = { bg: string; text: string; dot: string; border: string };

// Light palette
const TOKENS_LIGHT: Record<NamedVariant, TokenSet> = {
  default: {
    bg: "#F1F3F9",
    text: "#475569",
    border: "#E2E5ED",
    dot: "#94A3B8",
  },
  success: {
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
    dot: "#16A34A",
  },
  warning: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#D97706",
  },
  error: { bg: "#FFF1F2", text: "#991B1B", border: "#FECACA", dot: "#DC2626" },
  info: { bg: "#EEF2FF", text: "#1E3A8A", border: "#C7D2FE", dot: "#3B5BDB" },
  purple: { bg: "#F5F3FF", text: "#6B21A8", border: "#DDD6FE", dot: "#7C3AED" },
};

// Dark palette — same semantic meaning, tuned for dark backgrounds
const TOKENS_DARK: Record<NamedVariant, TokenSet> = {
  default: {
    bg: "#1E293B",
    text: "#94A3B8",
    border: "#334155",
    dot: "#64748B",
  },
  success: {
    bg: "#052E16",
    text: "#4ADE80",
    border: "#166534",
    dot: "#4ADE80",
  },
  warning: {
    bg: "#1C1400",
    text: "#FCD34D",
    border: "#713F12",
    dot: "#FCD34D",
  },
  error: { bg: "#2D0B0B", text: "#F87171", border: "#7F1D1D", dot: "#F87171" },
  info: { bg: "#1E2A4A", text: "#93C5FD", border: "#2D3F6E", dot: "#6B8EF0" },
  purple: { bg: "#1A0E2E", text: "#C084FC", border: "#4C1D95", dot: "#A855F7" },
};

/**
 * Detect dark mode — same multi-convention logic as SelectCell.
 * Walks DOM tree + checks all common dark mode attributes.
 */
function isDark(): boolean {
  if (typeof document === "undefined") return false;

  // Walk up from [data-reaktiform] to catch dark on any ancestor
  const el = document.querySelector("[data-reaktiform]");
  if (el) {
    let node: Element | null = el;
    while (node) {
      if (
        node.classList.contains("dark") ||
        node.getAttribute("data-theme") === "dark" ||
        node.getAttribute("data-color-mode") === "dark" ||
        node.getAttribute("data-bs-theme") === "dark"
      )
        return true;
      node = node.parentElement;
    }
  }

  // Fallback: check html/body directly
  const html = document.documentElement;
  if (
    html.classList.contains("dark") ||
    html.getAttribute("data-theme") === "dark" ||
    html.getAttribute("data-color-mode") === "dark" ||
    html.getAttribute("data-bs-theme") === "dark" ||
    document.body?.classList.contains("dark")
  )
    return true;

  // OS preference — only when no explicit light class is set
  if (
    !html.classList.contains("light") &&
    html.getAttribute("data-theme") !== "light" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  )
    return true;

  return false;
}

const TOKENS: Record<NamedVariant, TokenSet> = TOKENS_LIGHT; // kept for TS reference

// ── Colour utilities ───────────────────────────────────────────

/** Derive a full TokenSet from any CSS color string */
function deriveTokens(color: string): TokenSet {
  // Light pastel background — for hex we add low-opacity suffix; for others use a pale fallback
  const bg =
    color.startsWith("#") && color.length === 7
      ? color + "18" // 9% opacity hex (e.g. #E53E3E18)
      : color.startsWith("#") && color.length === 4
        ? "#" +
          color[1] +
          color[1] +
          color[2] +
          color[2] +
          color[3] +
          color[3] +
          "18"
        : "rgba(0,0,0,0.06)"; // fallback for rgb/hsl/named
  const border =
    color.startsWith("#") && color.length === 7
      ? color + "40" // 25% opacity
      : "rgba(0,0,0,0.15)";
  const text = color; // use the color itself as text — it's the "brand" color
  const dot = color;

  return { bg, text, dot, border };
}

/** Resolve SelectOption.color → full TokenSet */
function resolveTokens(color: SelectOption["color"]): TokenSet {
  if (!color) return TOKENS.default;

  // Named token — pick light or dark palette at call time
  if (typeof color === "string" && NAMED.has(color as NamedVariant)) {
    return (isDark() ? TOKENS_DARK : TOKENS_LIGHT)[color as NamedVariant];
  }

  // Custom object — user provides specific values, fill gaps from bg if given
  if (typeof color === "object") {
    const derived = color.bg ? deriveTokens(color.bg) : TOKENS.default;
    return {
      bg: color.bg ?? derived.bg,
      text: color.text ?? derived.text,
      dot: color.dot ?? color.bg ?? derived.dot,
      border: color.border ?? derived.border,
    };
  }

  // CSS color string — auto-derive
  return deriveTokens(color as string);
}

// ─────────────────────────────────────────────────────────────
//  BADGE COMPONENT
// ─────────────────────────────────────────────────────────────
export type BadgeColor = SelectOption["color"];

type BadgeProps = {
  label: string;
  /**
   * Controls badge appearance. Accepts:
   * - Named token: 'success' | 'warning' | 'error' | 'info' | 'purple' | 'default'
   * - CSS string: '#E53E3E' | 'rgb(229,62,62)' | 'tomato' (auto-derives styles)
   * - Object: { bg?, text?, dot?, border? } (full manual control)
   */
  variant?: BadgeColor;
  showDot?: boolean;
  style?: React.CSSProperties; // additional inline styles
  className?: string;
};

export function Badge({
  label,
  variant = "default",
  showDot = true,
  style: extraStyle,
  className,
}: BadgeProps) {
  const t = resolveTokens(variant);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        border: `1px solid ${t.border}`,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        fontFamily: "inherit",
        backgroundColor: t.bg,
        color: t.text,
        ...extraStyle,
      }}
    >
      {showDot && (
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: t.dot,
          }}
        />
      )}
      {label}
    </span>
  );
}

// ── Render a SelectOption as a Badge
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
      variant={option.color}
      {...(className !== undefined && { className })}
    />
  );
}

// ── Kept for backward compat — maps color to itself (resolveTokens handles all cases)
export function getOptionVariant(
  color: SelectOption["color"],
): SelectOption["color"] {
  return color;
}
