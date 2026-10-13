import type { CFResult, CFRule, CFTone } from "@/types";

// ─────────────────────────────────────────────────────────────
//  CF PRESET COLORS — quick-pick swatches
//  `bg` / `text` are the LIGHT-mode values (and what gets stored on the
//  rule as backgroundColor / textColor). The rendered colours come from
//  the `--rf-cf-<tone>-*` tokens in reaktiform.css, which also define the
//  dark-mode variants — keep the light values there in sync with these.
// ─────────────────────────────────────────────────────────────
export const CF_COLORS: {
  tone: CFTone;
  label: string;
  bg: string;
  text: string;
}[] = [
  { tone: "red", label: "Red", bg: "#FFF1F2", text: "#991B1B" },
  { tone: "orange", label: "Orange", bg: "#FFF7ED", text: "#9A3412" },
  { tone: "yellow", label: "Yellow", bg: "#FEFCE8", text: "#854D0E" },
  { tone: "green", label: "Green", bg: "#F0FDF4", text: "#166534" },
  { tone: "blue", label: "Blue", bg: "#EFF6FF", text: "#1E40AF" },
  { tone: "purple", label: "Purple", bg: "#FAF5FF", text: "#6B21A8" },
  { tone: "teal", label: "Teal", bg: "#F0FDFA", text: "#115E59" },
  { tone: "pink", label: "Pink", bg: "#FFF0F6", text: "#9D174D" },
];

// Default for new rules — not offered as a swatch, but a real tone so new
// rules are theme-aware from the start.
export const CF_DEFAULT_COLOR = {
  tone: "amber" as CFTone,
  bg: "#FEF3C7",
  text: "#92400E",
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Text colour for a highlighted row: the tone's hue blended toward the
 * theme's primary text. Pure tone text (e.g. green-800 on green-50) sits
 * at ~6–8:1; the 50% blend keeps a visible hue at ~10–12:1 (WCAG AAA) in
 * both themes. `--rf-cf-fg-strength` tunes it per host: 0% = plain theme
 * text, 100% = pure tone text. Resolve it only where --rf-cf-fg is defined
 * (the row, or an element carrying getCFResult().vars).
 */
export const CF_TEXT_COLOR =
  "color-mix(in srgb, var(--rf-cf-fg) var(--rf-cf-fg-strength, 50%), var(--rf-text-1))";

// ─────────────────────────────────────────────────────────────
//  COLOR UTILITIES
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
 * Given any picked hex color, produce a readable highlight pair for each
 * theme, keeping the picked hue:
 * - light: very light background (L 93%) + dark text (L 22%)
 * - dark:  dark, low-saturation background (L 18%) + light text (L 80%)
 * Both pairs clear WCAG AA (4.5:1) across the hue wheel.
 */
export function buildCFColors(pickedHex: string): {
  bg: string;
  text: string;
  darkBg: string;
  darkText: string;
} {
  const [h, s] = hexToHsl(pickedHex);
  return {
    bg: hslToHex(h, Math.min(s, 65), 93),
    text: hslToHex(h, Math.min(s + 10, 90), 22),
    darkBg: hslToHex(h, Math.min(s, 35), 18),
    darkText: hslToHex(h, Math.min(s + 10, 80), 80),
  };
}

// ─────────────────────────────────────────────────────────────
//  RULE → THEME-AWARE COLOURS
// ─────────────────────────────────────────────────────────────

/**
 * The rule's palette. Rules saved before `tone` existed only carry hex
 * values — a preset hex maps back to its tone, so old rules (localStorage,
 * initialCFRules, onStoragePersist payloads) become theme-aware without a
 * data migration. Returns null for a custom colour.
 */
export function resolveCFTone(
  rule: Pick<CFRule, "tone" | "backgroundColor">,
): CFTone | null {
  if (rule.tone) return rule.tone;
  const bg = rule.backgroundColor.toLowerCase();
  if (bg === CF_DEFAULT_COLOR.bg.toLowerCase()) return CF_DEFAULT_COLOR.tone;
  return CF_COLORS.find((p) => p.bg.toLowerCase() === bg)?.tone ?? null;
}

// Custom colours re-derive their dark pair on every row render otherwise.
const customCache = new Map<string, NonNullable<CFResult>>();
const CUSTOM_CACHE_MAX = 64;

function customResult(bg: string, text: string): NonNullable<CFResult> {
  const key = `${bg}|${text}`;
  const hit = customCache.get(key);
  if (hit) return hit;

  // Non-hex values (rgb(), named colours from an API) can't be converted
  // through HSL — tint the dark surface with them instead and keep the
  // theme's own text colour, which is readable on any dark tint.
  const dark = HEX_RE.test(bg)
    ? buildCFColors(bg)
    : {
        darkBg: `color-mix(in srgb, ${bg} 16%, var(--rf-surface))`,
        darkText: "var(--rf-text-1)",
      };

  const result: NonNullable<CFResult> = {
    backgroundColor: bg,
    textColor: text,
    tone: null,
    vars: {
      "--rf-cf-bg-light": bg,
      "--rf-cf-fg-light": text,
      "--rf-cf-bg-dark": dark.darkBg,
      "--rf-cf-fg-dark": dark.darkText,
    },
  };

  if (customCache.size >= CUSTOM_CACHE_MAX) customCache.clear();
  customCache.set(key, result);
  return result;
}

const toneResults = new Map<CFTone, NonNullable<CFResult>>();

/** Theme-aware colours for a matched rule. */
export function getCFResult(
  rule: Pick<CFRule, "tone" | "backgroundColor" | "textColor">,
): NonNullable<CFResult> {
  const tone = resolveCFTone(rule);
  if (!tone) return customResult(rule.backgroundColor, rule.textColor);

  let result = toneResults.get(tone);
  if (!result) {
    result = {
      backgroundColor: `var(--rf-cf-${tone}-bg)`,
      textColor: `var(--rf-cf-${tone}-fg)`,
      tone,
      vars: {
        "--rf-cf-bg": `var(--rf-cf-${tone}-bg)`,
        "--rf-cf-fg": `var(--rf-cf-${tone}-fg)`,
      },
    };
    toneResults.set(tone, result);
  }
  return result;
}
