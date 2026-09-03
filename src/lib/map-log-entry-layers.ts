import type { LogEntry, LogEntryType } from '../domain/logbook'
import {
  isDirectionChangeEntry,
  isVideoLogEntry,
} from './log-entry-map-marker'

/** User-facing map layer toggle — one checkbox may cover several entry types. */
export type MapLogEntryLayerToggleId =
  | 'trip'
  | 'sails'
  | 'engine'
  | 'anchor-mooring'
  | 'log'
  | 'media'
  | 'auto'

/** Resolved layer for a single map marker (may map to a grouped toggle). */
export type MapLogEntryLayerId = LogEntryType | 'VIDEO' | 'DIRECTION_CHANGE'

export type MapLogEntryLayerToggleDefinition = {
  id: MapLogEntryLayerToggleId
  title: string
  description: string
  defaultVisible: boolean
}

export const MAP_LOG_ENTRY_LAYER_TOGGLES: MapLogEntryLayerToggleDefinition[] = [
  {
    id: 'trip',
    title: 'Trip',
    description: 'Start and end trip markers.',
    defaultVisible: true,
  },
  {
    id: 'sails',
    title: 'Sails',
    description: 'Sails up and down.',
    defaultVisible: true,
  },
  {
    id: 'engine',
    title: 'Engine',
    description: 'Engine on and off.',
    defaultVisible: true,
  },
  {
    id: 'anchor-mooring',
    title: 'Anchor & mooring',
    description: 'Anchor dropped or weighed, moored, and cast off.',
    defaultVisible: true,
  },
  {
    id: 'log',
    title: 'Log',
    description: 'Notes and hourly position logs.',
    defaultVisible: true,
  },
  {
    id: 'media',
    title: 'Media',
    description: 'Photos, video, and voice notes.',
    defaultVisible: true,
  },
  {
    id: 'auto',
    title: 'Direction changes',
    description: 'Auto-detected course changes.',
    defaultVisible: true,
  },
]

const LAYER_ID_TO_TOGGLE: Record<MapLogEntryLayerId, MapLogEntryLayerToggleId> = {
  START_TRIP: 'trip',
  END_TRIP: 'trip',
  SAILS_UP: 'sails',
  SAILS_DOWN: 'sails',
  ENGINE_ON: 'engine',
  ENGINE_OFF: 'engine',
  ANCHOR_DROPPED: 'anchor-mooring',
  ANCHOR_WEIGHED: 'anchor-mooring',
  MOORED: 'anchor-mooring',
  CAST_OFF: 'anchor-mooring',
  NOTE: 'log',
  HOURLY_LOG: 'log',
  PHOTO: 'media',
  VIDEO: 'media',
  VOICE_NOTE: 'media',
  DIRECTION_CHANGE: 'auto',
}

const TOGGLE_MEMBER_LAYER_IDS: Record<
  MapLogEntryLayerToggleId,
  MapLogEntryLayerId[]
> = {
  trip: ['START_TRIP', 'END_TRIP'],
  sails: ['SAILS_UP', 'SAILS_DOWN'],
  engine: ['ENGINE_ON', 'ENGINE_OFF'],
  'anchor-mooring': ['ANCHOR_DROPPED', 'ANCHOR_WEIGHED', 'MOORED', 'CAST_OFF'],
  log: ['NOTE', 'HOURLY_LOG'],
  media: ['PHOTO', 'VIDEO', 'VOICE_NOTE'],
  auto: ['DIRECTION_CHANGE'],
}

export type MapLogEntryLayerToggles = Record<MapLogEntryLayerToggleId, boolean>

export function defaultMapLogEntryLayerToggles(): MapLogEntryLayerToggles {
  return Object.fromEntries(
    MAP_LOG_ENTRY_LAYER_TOGGLES.map((layer) => [layer.id, layer.defaultVisible]),
  ) as MapLogEntryLayerToggles
}

function migrateLegacyMapLogEntryLayerToggles(
  persisted: Partial<Record<string, boolean>>,
): Partial<MapLogEntryLayerToggles> {
  const migrated: Partial<MapLogEntryLayerToggles> = {}

  for (const toggle of MAP_LOG_ENTRY_LAYER_TOGGLES) {
    if (toggle.id in persisted) {
      migrated[toggle.id] = persisted[toggle.id]
      continue
    }

    const legacyValues = TOGGLE_MEMBER_LAYER_IDS[toggle.id]
      .map((layerId) => persisted[layerId])
      .filter((value): value is boolean => value !== undefined)

    if (legacyValues.length > 0) {
      migrated[toggle.id] = legacyValues.every(Boolean)
    }
  }

  return migrated
}

export function mergeMapLogEntryLayerToggles(
  persisted: Partial<Record<string, boolean>> | undefined,
): MapLogEntryLayerToggles {
  return {
    ...defaultMapLogEntryLayerToggles(),
    ...migrateLegacyMapLogEntryLayerToggles(persisted ?? {}),
  }
}

export function logEntryMapLayerId(
  entry: Pick<LogEntry, 'type' | 'data'>,
): MapLogEntryLayerId {
  if (isDirectionChangeEntry(entry)) return 'DIRECTION_CHANGE'
  if (isVideoLogEntry(entry)) return 'VIDEO'
  return entry.type
}

export function logEntryMapLayerToggleId(
  entry: Pick<LogEntry, 'type' | 'data'>,
): MapLogEntryLayerToggleId {
  return LAYER_ID_TO_TOGGLE[logEntryMapLayerId(entry)]
}

export function isLogEntryMapLayerVisible(
  entry: Pick<LogEntry, 'type' | 'data'>,
  toggles: MapLogEntryLayerToggles,
): boolean {
  const toggleId = logEntryMapLayerToggleId(entry)
  return toggles[toggleId] ?? true
}

export function filterEntriesForMapLogLayers<T extends LogEntry>(
  entries: T[],
  toggles: MapLogEntryLayerToggles,
): T[] {
  return entries.filter(
    (entry) =>
      !entry.deleted && isLogEntryMapLayerVisible(entry, toggles),
  )
}

export function mapLogEntryLayerTogglePatch(
  toggleId: MapLogEntryLayerToggleId,
  visible: boolean,
): Partial<MapLogEntryLayerToggles> {
  return { [toggleId]: visible }
}
