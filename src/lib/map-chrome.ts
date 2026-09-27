/** Map control chrome — white in light mode, dark in dark mode. */
export const MAP_CHROME_SURFACE_CLASS = 'map-chrome-surface rounded-md' as const

export const MAP_CHROME_BUTTON_HOVER_CLASS =
  'hover:bg-[var(--map-chrome-hover)]' as const

export const MAP_CHROME_DIVIDER_CLASS =
  'border-t border-[var(--map-chrome-border)]' as const

export const MAP_CHROME_CELL_CLASS =
  'flex size-[35px] items-center justify-center transition' as const

/** Operational toggles on the trip map — 50% larger touch targets. */
export const MAP_CHROME_OPERATIONAL_CELL_CLASS =
  'flex size-[43.5px] items-center justify-center transition' as const

/** Operational map artwork: dark lines in light mode, light lines in dark mode. */
export const MAP_CHROME_OPERATIONAL_ICON_CLASS = 'map-chrome-icon-img' as const
