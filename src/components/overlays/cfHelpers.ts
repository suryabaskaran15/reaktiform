import type { ColumnDef } from "../../types";

// ─────────────────────────────────────────────────────────────
//  CF PRESET COLORS — quick-pick swatches
// ─────────────────────────────────────────────────────────────
export const CF_COLORS = [
  { label: "Red", bg: "#FFF1F2", text: "#991B1B" },
  { label: "Orange", bg: "#FFF7ED", text: "#9A3412" },
  { label: "Yellow", bg: "#FEFCE8", text: "#854D0E" },
  { label: "Green", bg: "#F0FDF4", text: "#166534" },
  { label: "Blue", bg: "#EFF6FF", text: "#1E40AF" },
  { label: "Purple", bg: "#FAF5FF", text: "#6B21A8" },
  { label: "Teal", bg: "#F0FDFA", text: "#115E59" },
  { label: "Pink", bg: "#FFF0F6", text: "#9D174D" },
];

// ─────────────────────────────────────────────────────────────
//  COLOR UTILITIES for CF color picker
// ─────────────────────────────────────────────────────────────

/** Convert hex to HSL */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Convert HSL to hex */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = h / 360,
    ss = s / 100,
    ll = l / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (ss === 0) {
    r = g = b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Given any picked hex color, produce a light-shade background
 * (L clamped to 88–96%) and a matching dark text color (L ~20–30%).
 * This ensures the row highlight is always a soft pastel,
 * never a dark or saturated color that hides text.
 */
export function buildCFColors(pickedHex: string): { bg: string; text: string } {
  const [h, s] = hexToHsl(pickedHex);
  // Background: same hue, reduced saturation, very light
  const bgL = 93; // lightness 93% → always a soft pastel
  const bgS = Math.min(s, 65); // cap saturation so it stays light
  // Text: same hue, high saturation, dark
  const textL = 22;
  const textS = Math.min(s + 10, 90);
  return {
    bg: hslToHex(h, bgS, bgL),
    text: hslToHex(h, textS, textL),
  };
}

/** For W3C luminance check — used only for preset swatches */
// function deriveTextColor(hexBg: string): string {
//   const [, , l] = hexToHsl(hexBg);
//   return l > 55 ? "#1E293B" : "#F8FAFC";
// }

// ─────────────────────────────────────────────────────────────
//  OPERATORS filtered by column type
// ─────────────────────────────────────────────────────────────
const CF_OPS_TEXT = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
];
const CF_OPS_NUMBER = [
  { value: "eq", label: "= equals" },
  { value: "neq", label: "≠ not equals" },
  { value: "gt", label: "> greater than" },
  { value: "gte", label: "≥ at least" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "≤ at most" },
];
const CF_OPS_SELECT = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is one of" },
];
const CF_OPS_BOOL = [{ value: "eq", label: "is" }];
const CF_OPS_DATE = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "after" },
  { value: "gte", label: "on or after" },
  { value: "lt", label: "before" },
  { value: "lte", label: "on or before" },
];

export function getCFOps(type: ColumnDef["type"] | undefined) {
  if (!type) return CF_OPS_TEXT;
  if (["select", "multiselect", "badge"].includes(type)) return CF_OPS_SELECT;
  if (["checkbox"].includes(type)) return CF_OPS_BOOL;
  if (["number", "currency", "percentage", "rating", "progress"].includes(type))
    return CF_OPS_NUMBER;
  if (type === "date") return CF_OPS_DATE;
  return CF_OPS_TEXT;
}
