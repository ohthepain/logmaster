export type TripMapView = {
  west: number
  south: number
  east: number
  north: number
  zoom: number
  style: unknown
}

export type TripMapHandle = {
  zoomIn: () => void
  zoomOut: () => void
  locate: () => void
  captureMapSnapshot: () => Promise<string | null>
  getMapView: () => TripMapView | null
}
