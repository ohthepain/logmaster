/** Shared NauticExpo manufacturer stands (admin UI + crawl jobs). */
export const NAUTICEXPO_MANUFACTURER_PRESETS = {
  'victron-energy': {
    displayName: 'Victron Energy',
    manufacturerUrl:
      'https://www.nauticexpo.com/prod/victron-energy-22393.html',
    brandSlug: 'victron-energy',
  },
  raymarine: {
    displayName: 'Raymarine',
    manufacturerUrl: 'https://www.nauticexpo.com/prod/raymarine-21527.html',
    brandSlug: 'raymarine',
  },
} as const

export type NauticExpoManufacturerPreset =
  keyof typeof NAUTICEXPO_MANUFACTURER_PRESETS

export type NauticExpoSeedProfile = 'equipment' | NauticExpoManufacturerPreset

export const NAUTICEXPO_CRAWL_SEED_OPTIONS: Array<{
  id: NauticExpoSeedProfile
  label: string
}> = [
  { id: 'equipment', label: 'Equipment categories (NauticExpo hub)' },
  ...(
    Object.entries(NAUTICEXPO_MANUFACTURER_PRESETS) as Array<
      [
        NauticExpoManufacturerPreset,
        (typeof NAUTICEXPO_MANUFACTURER_PRESETS)[NauticExpoManufacturerPreset],
      ]
    >
  ).map(([id, preset]) => ({
    id,
    label: preset.displayName,
  })),
]
