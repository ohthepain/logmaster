import type maplibregl from 'maplibre-gl'
import { useEffect, useState, type RefObject } from 'react'
import type { MapLngLat } from './logbook-map-geo'
import { readMapCenter } from './map-center-position'

export function useMapCenterPosition(
  mapRef: RefObject<maplibregl.Map | null>,
  mapReady: boolean,
  active: boolean,
) {
  const [position, setPosition] = useState<MapLngLat | null>(null)

  useEffect(() => {
    if (!active) {
      setPosition(null)
      return
    }

    const map = mapRef.current
    if (!map || !mapReady) return

    const update = () => {
      setPosition(readMapCenter(map))
    }

    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [active, mapReady, mapRef])

  return position
}
