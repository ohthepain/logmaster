/** Measured bottom safe-area inset (iOS home indicator). Requires viewport-fit=cover. */
export function measureSafeAreaInsetBottom(): number {
  if (typeof document === "undefined") return 0;

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)";
  document.documentElement.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return value;
}

/** Drag handle touch target — sits above the system home indicator. */
export const BOTTOM_SHEET_DRAG_ZONE_PX = 48;

/** Minimum inset below the handle when the OS reports no safe area. */
export const BOTTOM_SHEET_MIN_INSET_PX = 10;

/** Default collapsed height as a fraction of the trip map area. */
export const BOTTOM_SHEET_PEEK_RATIO = 0.0;

export function bottomSheetPeekHeight(containerHeight: number, safeAreaBottom: number): number {
  const inset = Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX);
  const minChrome = BOTTOM_SHEET_DRAG_ZONE_PX + inset;
  if (containerHeight <= 0) return minChrome;
  return Math.max(minChrome, Math.round(containerHeight * BOTTOM_SHEET_PEEK_RATIO));
}

export function bottomSheetDragChromeHeight(safeAreaBottom: number): number {
  return BOTTOM_SHEET_DRAG_ZONE_PX + Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX);
}
