import type { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────
//  SMART POPUP POSITION
//  Computes the best position for a popup anchored to a button.
//  - Prefers to open BELOW the button, left-aligned
//  - Falls back to ABOVE if not enough space below
//  - Clamps horizontally so panel never goes off screen right edge
// ─────────────────────────────────────────────────────────────
/**
 * Compute fixed position for a panel anchored to a button.
 *
 * Strategy:
 *  1. Try to open BELOW the button, right-aligned with its right edge
 *  2. If panel would overflow the right edge, align left edge instead
 *  3. If panel would overflow bottom, flip ABOVE the button
 *  4. Always clamp to viewport bounds with 8px margin
 */
export function useAnchoredPosition(
  anchor: DOMRect | null,
  panelWidth: number,
  panelHeight: number,
  gap = 6,
): CSSProperties {
  if (!anchor) {
    // Should not happen — both panels only render when anchor is set.
    // Fallback: below toolbar, right-aligned
    return { position: "fixed", top: 56 + gap, right: 8 };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Vertical: prefer below, flip above if no space
  let top = anchor.bottom + gap;
  if (top + panelHeight > vh - 8) {
    top = anchor.top - panelHeight - gap;
  }
  top = Math.max(8, top);

  // ── Horizontal: right-align panel to button's right edge by default
  // (looks natural for toolbar buttons on the right side)
  let left = anchor.right - panelWidth;

  // If that pushes panel off left edge, left-align with button instead
  if (left < 8) {
    left = anchor.left;
  }

  // If still overflows right (very narrow viewport), clamp to right margin
  if (left + panelWidth > vw - 8) {
    left = vw - panelWidth - 8;
  }

  // Final left clamp
  left = Math.max(8, left);

  return { position: "fixed", top, left };
}
