/**
 * Compute the scrollLeft needed to bring a non-pinned column's cell fully
 * into view, using "nearest" (least-movement) semantics — the horizontal
 * equivalent of Element.scrollIntoView({ block: 'nearest' }), which the
 * browser can't do here natively since the containing <tr> already spans
 * the full scrollable width.
 *
 * Returns null when no scroll is needed — the column is pinned (always
 * visible via position:sticky) or already fully within the pin-safe-zone-
 * adjusted visible rect. Callers must skip the scrollLeft write in that
 * case.
 */
export function getNearestScrollLeft(params: {
  scrollLeft: number;
  clientWidth: number;
  colLeft: number;
  colWidth: number;
  totalPinnedWidth: number;
  isPinned: boolean;
}): number | null {
  const {
    scrollLeft,
    clientWidth,
    colLeft,
    colWidth,
    totalPinnedWidth,
    isPinned,
  } = params;
  if (isPinned) return null;

  const visibleLeft = scrollLeft + totalPinnedWidth;
  const visibleRight = scrollLeft + clientWidth;
  const colRight = colLeft + colWidth;

  let next = scrollLeft;
  if (colLeft < visibleLeft) next = colLeft - totalPinnedWidth;
  else if (colRight > visibleRight) next = colRight - clientWidth;
  next = Math.max(0, next);

  return next === scrollLeft ? null : next;
}
