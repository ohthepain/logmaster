/** Map control chrome — matches SailingMapControlStack surfaces. */
export const MAP_CHROME_SURFACE_CLASS =
  'rounded-md border border-[rgba(126,200,232,0.2)] bg-[rgba(26,51,72,0.94)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]' as const

export const MAP_CHROME_BUTTON_HOVER_CLASS =
  'hover:bg-[rgba(126,200,232,0.16)]' as const

export const MAP_CHROME_DIVIDER_CLASS =
  'border-t border-[rgba(126,200,232,0.2)]' as const

export const MAP_CHROME_CELL_CLASS =
  'flex size-[29px] items-center justify-center transition' as const

/** Operational toggles on the trip map — 50% larger touch targets. */
export const MAP_CHROME_OPERATIONAL_CELL_CLASS =
  'flex size-[43.5px] items-center justify-center transition' as const

/** Operational map toggles — force icons to full white on dark chrome. */
export const MAP_CHROME_OPERATIONAL_ICON_CLASS = 'brightness-0 invert' as const
