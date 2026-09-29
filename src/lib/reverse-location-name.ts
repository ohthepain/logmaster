const LOCALITY_KEYS = [
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'suburb',
  'city_district',
  'island',
] as const

function named(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return null
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+/.test(trimmed)) return null
  return trimmed
}

/** Short place label from a Nominatim reverse-geocode address. */
export function formatReverseGeocodedLocationName(
  address?: Record<string, string | undefined> | null,
  displayName?: string | null,
): string | null {
  const locality = LOCALITY_KEYS.map((key) => named(address?.[key])).find(
    (value): value is string => Boolean(value),
  )
  const area = [address?.county, address?.state]
    .map((value) => named(value))
    .find((value): value is string => Boolean(value) && value !== locality)
  const country = named(address?.country)

  if (locality && area) return `${locality}, ${area}`
  if (locality && country && country !== locality) {
    return `${locality}, ${country}`
  }
  if (locality) return locality

  const titled = named(displayName?.split(',')[0])
  if (titled && country && titled !== country) return `${titled}, ${country}`
  return titled ?? country
}
