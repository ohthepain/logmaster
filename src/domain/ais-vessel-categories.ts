/** MarineTraffic-style AIS vessel categories for map colours. */

export type AisVesselCategory =
  | 'cargo'
  | 'tanker'
  | 'passenger'
  | 'hsc'
  | 'tug_special'
  | 'fishing'
  | 'pleasure'
  | 'unspecified'

export const AIS_VESSEL_CATEGORY_ORDER: AisVesselCategory[] = [
  'cargo',
  'tanker',
  'passenger',
  'hsc',
  'tug_special',
  'fishing',
  'pleasure',
  'unspecified',
]

/** Approximate MarineTraffic Live Map colours. */
export const AIS_VESSEL_CATEGORY_COLORS: Record<AisVesselCategory, string> = {
  cargo: '#43a047',
  tanker: '#e53935',
  passenger: '#1e88e5',
  hsc: '#fdd835',
  tug_special: '#26a69a',
  fishing: '#fb8c00',
  pleasure: '#ec407a',
  unspecified: '#9e9e9e',
}

export const AIS_VESSEL_CATEGORY_LABELS: Record<AisVesselCategory, string> = {
  cargo: 'Cargo',
  tanker: 'Tanker',
  passenger: 'Passenger',
  hsc: 'High speed craft',
  tug_special: 'Tug / special craft',
  fishing: 'Fishing',
  pleasure: 'Pleasure craft',
  unspecified: 'Unspecified',
}

const AIS_SHIP_TYPE_LABELS: Record<number, string> = {
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing (large)',
  33: 'Dredger',
  34: 'Dive ops',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure craft',
  40: 'High speed craft',
  41: 'HSC (hazard A)',
  42: 'HSC (hazard B)',
  43: 'HSC (hazard C)',
  44: 'HSC (hazard D)',
  50: 'Pilot vessel',
  51: 'SAR',
  52: 'Tug',
  53: 'Port tender',
  54: 'Anti-pollution',
  55: 'Law enforcement',
  58: 'Medical transport',
  59: 'Noncombatant',
  60: 'Passenger',
  61: 'Passenger (hazard A)',
  70: 'Cargo',
  71: 'Cargo (hazard A)',
  80: 'Tanker',
  81: 'Tanker (hazard A)',
  90: 'Other',
}

const NAVIGATIONAL_STATUS_LABELS: Record<number, string> = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  9: 'Reserved (HSC)',
  10: 'Reserved (WIG)',
  11: 'Power-driven towing astern',
  12: 'Power-driven pushing ahead',
  13: 'Reserved',
  14: 'AIS-SART',
  15: 'Undefined',
}

export function aisShipTypeLabel(shipType: number | null | undefined): string | null {
  if (shipType == null || !Number.isFinite(shipType)) return null
  return AIS_SHIP_TYPE_LABELS[shipType] ?? `AIS type ${shipType}`
}

export function aisNavigationalStatusLabel(status: number | null | undefined): string | null {
  if (status == null || !Number.isFinite(status)) return null
  return NAVIGATIONAL_STATUS_LABELS[status] ?? `Status ${status}`
}

/** Map IMO/AIS ship type code to a MarineTraffic-style category. */
export function aisCategoryForShipType(shipType: number | null | undefined): AisVesselCategory {
  if (shipType == null || !Number.isFinite(shipType) || shipType === 0) {
    return 'unspecified'
  }

  if (shipType === 37 || shipType === 36) return 'pleasure'
  if (shipType >= 30 && shipType <= 39) return 'fishing'
  if (shipType >= 40 && shipType <= 49) return 'hsc'
  if (shipType >= 50 && shipType <= 59) return 'tug_special'
  if (shipType >= 60 && shipType <= 69) return 'passenger'
  if (shipType >= 70 && shipType <= 79) return 'cargo'
  if (shipType >= 80 && shipType <= 89) return 'tanker'

  return 'unspecified'
}

export function aisVesselIconId(category: AisVesselCategory): string {
  return `ais-vessel-${category}`
}
