// @vitest-environment jsdom
// src/tests/conditionalFormatColors.test.tsx
// ─────────────────────────────────────────────────────────────
// Conditional formatting colours must stay readable in BOTH themes.
// Rules used to carry light-only hex colours painted as-is, so dark mode
// rendered near-white text on a near-white pastel. Rules now resolve to
// theme tokens (--rf-cf-<tone>-*) or a derived light/dark pair.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { GridStoreProvider } from "../store";
import { useConditionalFormat } from "../hooks/useConditionalFormat";
import {
  CF_COLORS,
  CF_DEFAULT_COLOR,
  CF_TEXT_COLOR,
  buildCFColors,
  getCFResult,
  hslToHex,
  resolveCFTone,
} from "../utils/cfColors";
import type { CFRule, CFTone, Row } from "../types";

// ── WCAG 2.x contrast
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
// color-mix(in srgb, A p%, B) — per-channel mix of gamma-encoded values
function mixSrgb(a: string, pct: number, b: string): string {
  const out = [1, 3, 5].map((i) => {
    const ca = parseInt(a.slice(i, i + 2), 16);
    const cb = parseInt(b.slice(i, i + 2), 16);
    return Math.round(ca * (pct / 100) + cb * (1 - pct / 100))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`;
}

const AA = 4.5;
const AAA = 7;
// Default --rf-text-1 per theme; row text = tone fg blended toward these
const TEXT_LIGHT = "#0f172a";
const TEXT_DARK = "#f1f5f9";
const STRENGTH = 50; // --rf-cf-fg-strength default
const rowText = (fg: string, text1: string) => mixSrgb(fg, STRENGTH, text1);
const TONES: CFTone[] = [
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];

const rule = (over: Partial<CFRule>): CFRule => ({
  id: "r1",
  label: "Rule",
  conditions: [{ field: "status", op: "eq", value: "Not Started" }],
  logic: "AND",
  backgroundColor: "#F0FDF4",
  textColor: "#166534",
  enabled: true,
  ...over,
});

describe("resolveCFTone", () => {
  it("prefers an explicit tone", () => {
    expect(resolveCFTone({ tone: "blue", backgroundColor: "#F0FDF4" })).toBe(
      "blue",
    );
  });

  it("maps legacy preset hex values (any case) back to their tone", () => {
    for (const p of CF_COLORS) {
      expect(resolveCFTone({ backgroundColor: p.bg })).toBe(p.tone);
      expect(resolveCFTone({ backgroundColor: p.bg.toLowerCase() })).toBe(
        p.tone,
      );
    }
    expect(resolveCFTone({ backgroundColor: "#fef3c7" })).toBe(
      CF_DEFAULT_COLOR.tone,
    );
  });

  it("returns null for a custom colour", () => {
    expect(resolveCFTone({ backgroundColor: "#E0E7FF" })).toBeNull();
  });
});

describe("getCFResult", () => {
  it("resolves toned rules to theme tokens, never raw hex", () => {
    const r = getCFResult(rule({}));
    expect(r.tone).toBe("green");
    expect(r.vars).toEqual({
      "--rf-cf-bg": "var(--rf-cf-green-bg)",
      "--rf-cf-fg": "var(--rf-cf-green-fg)",
    });
    expect(r.backgroundColor).toBe("var(--rf-cf-green-bg)");
  });

  it("gives custom hex colours a derived dark pair", () => {
    const { bg, text } = buildCFColors("#6366F1");
    // The dark pair is derived from the stored (light) background's hue
    const { darkBg, darkText } = buildCFColors(bg);
    const r = getCFResult(rule({ backgroundColor: bg, textColor: text }));
    expect(r.tone).toBeNull();
    expect(r.vars).toEqual({
      "--rf-cf-bg-light": bg,
      "--rf-cf-fg-light": text,
      "--rf-cf-bg-dark": darkBg,
      "--rf-cf-fg-dark": darkText,
    });
  });

  it("falls back to a surface tint + theme text for non-hex custom colours", () => {
    const r = getCFResult(
      rule({ backgroundColor: "rgb(224, 231, 255)", textColor: "#312e81" }),
    );
    expect(r.vars["--rf-cf-bg-dark"]).toContain("var(--rf-surface)");
    expect(r.vars["--rf-cf-fg-dark"]).toBe("var(--rf-text-1)");
  });
});

describe("buildCFColors contrast", () => {
  it("rendered row text clears WCAG AAA in light and dark for every hue", () => {
    for (let h = 0; h < 360; h += 15) {
      for (const s of [30, 70, 100]) {
        const c = buildCFColors(hslToHex(h, s, 50));
        const at = `h=${h} s=${s}`;
        expect(
          contrast(c.bg, rowText(c.text, TEXT_LIGHT)),
          `light ${at}`,
        ).toBeGreaterThanOrEqual(AAA);
        expect(
          contrast(c.darkBg, rowText(c.darkText, TEXT_DARK)),
          `dark ${at}`,
        ).toBeGreaterThanOrEqual(AAA);
        // Hosts that set --rf-cf-fg-strength: 100% still get AA
        expect(
          contrast(c.bg, c.text),
          `light raw ${at}`,
        ).toBeGreaterThanOrEqual(AA);
        expect(
          contrast(c.darkBg, c.darkText),
          `dark raw ${at}`,
        ).toBeGreaterThanOrEqual(AA);
      }
    }
  });
});

describe("--rf-cf-* tokens in reaktiform.css", () => {
  const css = readFileSync(
    resolve(__dirname, "../styles/reaktiform.css"),
    "utf8",
  );
  const DARK_SURFACE = "#1e293b"; // reaktiform's default dark --rf-surface

  // First declaration is the light block, second the dark block.
  const decl = (name: string): [string, string] => {
    const all = [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map(
      (m) => m[1]!.trim(),
    );
    expect(all, name).toHaveLength(2);
    return [all[0]!, all[1]!];
  };

  it("row-text blend strength matches CF_TEXT_COLOR's fallback", () => {
    const [strength] = [
      ...css.matchAll(/--rf-cf-fg-strength:\s*([^;]+);/g),
    ].map((m) => m[1]!.trim());
    expect(strength).toBe(`${STRENGTH}%`);
    expect(CF_TEXT_COLOR).toContain(`var(--rf-cf-fg-strength, ${STRENGTH}%)`);
  });

  it("light values mirror CF_COLORS", () => {
    for (const p of [...CF_COLORS, { ...CF_DEFAULT_COLOR }]) {
      expect(decl(`--rf-cf-${p.tone}-bg`)[0].toLowerCase()).toBe(
        p.bg.toLowerCase(),
      );
      expect(decl(`--rf-cf-${p.tone}-fg`)[0].toLowerCase()).toBe(
        p.text.toLowerCase(),
      );
    }
  });

  it.each(TONES)("%s is readable in both themes", (tone) => {
    const [lightBg, darkBgExpr] = decl(`--rf-cf-${tone}-bg`);
    const [lightFg, darkFg] = decl(`--rf-cf-${tone}-fg`);
    expect(
      contrast(lightBg, rowText(lightFg, TEXT_LIGHT)),
    ).toBeGreaterThanOrEqual(AAA);
    expect(contrast(lightBg, lightFg)).toBeGreaterThanOrEqual(AA);

    const m =
      /color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, var\(--rf-surface\)\)/i.exec(
        darkBgExpr,
      );
    expect(m, darkBgExpr).not.toBeNull();
    const darkBg = mixSrgb(m![1]!, Number(m![2]), DARK_SURFACE);
    expect(contrast(darkBg, rowText(darkFg, TEXT_DARK))).toBeGreaterThanOrEqual(
      AAA,
    );
    expect(contrast(darkBg, darkFg)).toBeGreaterThanOrEqual(AA);
    // Subtle tint: the theme's own primary text stays readable too
    expect(contrast(darkBg, TEXT_DARK)).toBeGreaterThanOrEqual(AAA);
  });
});

describe("useConditionalFormat", () => {
  it("returns theme tokens for a legacy (hex-only) rule", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <GridStoreProvider initialState={{ cfRules: [rule({})] } as never}>
        {children}
      </GridStoreProvider>
    );
    const { result } = renderHook(() => useConditionalFormat(), { wrapper });
    const row = {
      _id: "_1",
      status: "Not Started",
      _draft: null,
    } as unknown as Row;

    expect(result.current.evalCF(row)?.vars["--rf-cf-bg"]).toBe(
      "var(--rf-cf-green-bg)",
    );
    expect(
      result.current.evalCF({ ...row, status: "Completed" } as unknown as Row),
    ).toBeNull();
  });
});
