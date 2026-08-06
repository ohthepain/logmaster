import { useEffect, useState } from 'react'
import type { MapLngLat } from './logbook-map-geo'
import {
  entryPlaceFromData,
  lookupPositionLabel,
  lookupPositionLabelFromPlace,
  type LogEntryPlace,
} from './logbook-place'
import { formatPosition } from './logbook-format'

export function usePositionPlaceLabel(
  position: MapLngLat | null,
  options?: {
    seedPlace?: LogEntryPlace | null
    enabled?: boolean
  },
) {
  const enabled = options?.enabled ?? true
  const [label, setLabel] = useState(() => {
    if (!enabled) return 'Position unavailable'
    if (!position) return 'Locating…'
    if (options?.seedPlace) {
      return lookupPositionLabelFromPlace(
        position.latitude,
        position.longitude,
        options.seedPlace,
      )
    }
    return formatPosition(position.latitude, position.longitude)
  })

  useEffect(() => {
    if (!enabled) {
      setLabel('Position unavailable')
      return
    }
    if (!position) {
      setLabel('Locating…')
      return
    }

    let cancelled = false
    setLabel(formatPosition(position.latitude, position.longitude))

    void lookupPositionLabel(position.latitude, position.longitude).then((text) => {
      if (!cancelled) setLabel(text)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, position?.latitude, position?.longitude])

  return label
}

export function seedPlaceFromEntryData(
  data?: Record<string, unknown> | null,
): LogEntryPlace | null {
  return entryPlaceFromData(data)
}
