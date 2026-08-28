/** CSS env() for the top safe area (Dynamic Island / status bar). Requires viewport-fit=cover. */
export const SAFE_AREA_TOP = "env(safe-area-inset-top, 0px)";

/** CSS env() for the bottom safe area (home indicator). Requires viewport-fit=cover. */
export const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";

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

/** Top offset for toasts and other chrome below Header (safe area + min-h-16 + py-2). */
export const APP_HEADER_TOP_OFFSET = "calc(env(safe-area-inset-top, 0px) + 5rem)";

/** Header inner chrome (min-h-16 + py-2) excluding the top safe-area inset. */
export const APP_HEADER_INNER_HEIGHT_PX = 80;

/** Measured top safe-area inset (Dynamic Island / status bar). Requires viewport-fit=cover. */
export function measureSafeAreaInsetTop(): number {
  if (typeof document === "undefined") return 0;

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)";
  document.documentElement.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return value;
}

/** Actual Header height, including the top safe-area inset. */
export function measureAppHeaderHeight(): number {
  if (typeof document === "undefined") return APP_HEADER_INNER_HEIGHT_PX;
  const header = document.querySelector("[data-app-header]");
  if (header instanceof HTMLElement) {
    return header.getBoundingClientRect().height;
  }
  return measureSafeAreaInsetTop() + APP_HEADER_INNER_HEIGHT_PX;
}

/** Expanded bottom-sheet height that stays below the app Header. */
export function bottomSheetFullHeight(
  containerHeight: number,
  headerHeight: number,
  peekHeight: number,
): number {
  if (containerHeight <= 0) return peekHeight;
  const available = Math.floor(containerHeight - Math.max(0, headerHeight));
  return Math.max(peekHeight, available);
}

/** Drag handle touch target — sits above the system home indicator. */
export const BOTTOM_SHEET_DRAG_ZONE_PX = 48;

/** Minimum inset below the handle when the OS reports no safe area. */
export const BOTTOM_SHEET_MIN_INSET_PX = 10;

/** Default collapsed height as a fraction of the trip map area. */
export const BOTTOM_SHEET_PEEK_RATIO = 0.16;

export function bottomSheetPeekHeight(containerHeight: number, safeAreaBottom: number): number {
  const inset = Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX);
  const minChrome = BOTTOM_SHEET_DRAG_ZONE_PX + inset;
  if (containerHeight <= 0) return minChrome;
  return Math.max(minChrome, Math.round(containerHeight * BOTTOM_SHEET_PEEK_RATIO));
}

export function bottomSheetDragChromeHeight(safeAreaBottom: number): number {
  return BOTTOM_SHEET_DRAG_ZONE_PX + Math.max(safeAreaBottom, BOTTOM_SHEET_MIN_INSET_PX);
}
