export type TripMapHandle = {
  zoomIn: () => void
  zoomOut: () => void
  locate: () => void
  captureMapSnapshot: () => Promise<string | null>
}
