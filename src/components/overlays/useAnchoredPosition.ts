import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

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
 *
 * `panelHeight` is only a same-frame fallback for the very first layout
 * pass — the real rendered height (via `panelRef`) is measured in a
 * `useLayoutEffect` and used to correct the flip/clamp decision before
 * the browser paints, so a short panel (e.g. a one-input text filter)
 * never flips away from the anchor just because a taller panel's height
 * was assumed for it.
 */
export function useAnchoredPosition(
  anchor: DOMRect | null,
  panelRef: RefObject<HTMLElement | null>,
  panelWidth: number,
  panelHeight: number,
  gap = 6,
): CSSProperties {
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  // Re-measures after every commit (no dep array) so it also tracks
  // content that changes height in place (e.g. wrapping option pills).
  // Only updates state when the value actually changed, so this
  // converges in one extra pass instead of looping.
  useLayoutEffect(() => {
    const h = panelRef.current?.getBoundingClientRect().height;
    if (h && h !== measuredHeight) setMeasuredHeight(h);
  });

  if (!anchor) {
    // Should not happen — both panels only render when anchor is set.
    // Fallback: below toolbar, right-aligned
    return { position: "fixed", top: 56 + gap, right: 8 };
  }

  const effectiveHeight = measuredHeight ?? panelHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Vertical: prefer below, flip above if no space
  let top = anchor.bottom + gap;
  if (top + effectiveHeight > vh - 8) {
    top = anchor.top - effectiveHeight - gap;
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
