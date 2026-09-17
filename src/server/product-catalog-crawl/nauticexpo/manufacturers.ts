import { NAUTICEXPO_MANUFACTURER_PRESETS } from '../../../lib/nauticexpo-manufacturer-presets'
import type {
  NauticExpoManufacturerPreset,
  NauticExpoSeedProfile,
} from '../../../lib/nauticexpo-manufacturer-presets'

export {
  NAUTICEXPO_MANUFACTURER_PRESETS,
  type NauticExpoManufacturerPreset,
  type NauticExpoSeedProfile,
} from '../../../lib/nauticexpo-manufacturer-presets'

export function manufacturerUrlForPreset(
  preset: NauticExpoManufacturerPreset,
): string {
  return NAUTICEXPO_MANUFACTURER_PRESETS[preset].manufacturerUrl
}

export function resolveSeedProfile(
  raw: string | null | undefined,
): NauticExpoSeedProfile {
  const value = raw?.trim() || 'equipment'
  if (value === 'equipment') return 'equipment'
  if (value in NAUTICEXPO_MANUFACTURER_PRESETS) {
    return value as NauticExpoManufacturerPreset
  }
  throw new Error(
    `Unknown --seed ${value}. Use equipment or a manufacturer preset: ${Object.keys(NAUTICEXPO_MANUFACTURER_PRESETS).join(', ')}`,
  )
}
