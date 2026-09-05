import type { MapLngLat } from './logbook-map-geo'

export type MapWaypointPickPhase = 'add' | 'edit-select' | 'edit-pick'

type MapWaypointPickAdd = {
  phase: 'add'
  busy?: boolean
  onCancel: () => void
  onConfirm: (position: MapLngLat) => void
}

type MapWaypointPickEditSelect = {
  phase: 'edit-select'
  onCancel: () => void
  onSelectEntry: (entryId: string) => void
}

type MapWaypointPickEditCenter = {
  phase: 'edit-center'
  editingEntryId: string
  onCancel: () => void
  onCentered: () => void
}

type MapWaypointPickEditMove = {
  phase: 'edit-pick'
  editingEntryId: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (position: MapLngLat) => void
  onDelete: () => void
}

export type MapWaypointPickConfig =
  | MapWaypointPickAdd
  | MapWaypointPickEditSelect
  | MapWaypointPickEditCenter
  | MapWaypointPickEditMove

export function isWaypointMapInteractionActive(
  config?: MapWaypointPickConfig | null,
): config is MapWaypointPickConfig {
  return config != null
}

export function isWaypointCenterPickActive(config?: MapWaypointPickConfig | null) {
  return config?.phase === 'add' || config?.phase === 'edit-pick'
}

export function isWaypointEditSelectActive(config?: MapWaypointPickConfig | null) {
  return config?.phase === 'edit-select'
}

export function isWaypointEditCenteringActive(config?: MapWaypointPickConfig | null) {
  return config?.phase === 'edit-center'
}
