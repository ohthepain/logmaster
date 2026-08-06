import {
  needsCastOff,
  resolveTripOperationalState,
} from './trip-state'
import type { TripOperationalState } from './trip-state'

export const TRIP_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const TRIP_COVER_KINDS = ['photo', 'map'] as const
export type TripCoverKind = (typeof TRIP_COVER_KINDS)[number]

export const LOG_ENTRY_TYPES = [
  'START_TRIP',
  'SAILS_UP',
  'ENGINE_ON',
  'ENGINE_OFF',
  'SAILS_DOWN',
  'ANCHOR_DROPPED',
  'ANCHOR_WEIGHED',
  'MOORED',
  'CAST_OFF',
  'END_TRIP',
  'NOTE',
  'HOURLY_LOG',
  'PHOTO',
  'VOICE_NOTE',
] as const
export type LogEntryType = (typeof LOG_ENTRY_TYPES)[number]

export const MEDIA_TYPES = ['photo', 'voice', 'attachment'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export type WeatherSnapshot = {
  temperatureC?: number | null
  windKph?: number | null
  pressureHpa?: number | null
  cloudCoverPct?: number | null
  source?: string | null
  observedAt?: string | null
}

export type Trip = {
  id: string
  boatName: string
  registration?: string | null
  skipper?: string | null
  skipperKey?: string | null
  crewMemberIds?: string[] | null
  title?: string | null
  coverPhotoDataUrl?: string | null
  coverKind?: TripCoverKind | null
  boatId?: string | null
  boatPhotoUrl?: string | null
  startedAt: string
  completedAt?: string | null
  startLatitude?: number | null
  startLongitude?: number | null
  startCountry?: string | null
  status: TripStatus
  sailsUp?: boolean | null
  engineOn?: boolean | null
  moored?: boolean | null
  anchorDown?: boolean | null
  createdAt: string
  updatedAt: string
}

export type Leg = {
  id: string
  tripId: string
  sequence: number
  title?: string | null
  startEventId?: string | null
  endEventId?: string | null
  startedAt: string
  endedAt?: string | null
  color: string
  createdAt: string
  updatedAt: string
  synced: boolean
}

export type LogEntry = {
  id: string
  tripId: string
  legId?: string | null
  type: LogEntryType
  timestamp: string
  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null
  heading?: number | null
  createdBy?: string | null
  notes?: string | null
  data?: Record<string, unknown> | null
  weather?: WeatherSnapshot | null
  createdAt: string
  updatedAt: string
  synced: boolean
  deleted: boolean
}

export type Media = {
  id: string
  logEntryId: string
  type: MediaType
  localPath?: string | null
  remoteUrl?: string | null
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
  synced: boolean
}

export type TripWithEntries = Trip & {
  legs: Leg[]
  entries: Array<LogEntry & { media: Media[] }>
}

export const EVENT_TYPES: Array<{
  type: LogEntryType
  label: string
  icon: string
}> = [
  { type: 'START_TRIP', label: 'Start Trip', icon: '⛵' },
  { type: 'SAILS_UP', label: 'Sails Up', icon: '🪢' },
  { type: 'ENGINE_ON', label: 'Engine On', icon: '⚙️' },
  { type: 'ENGINE_OFF', label: 'Engine Off', icon: '⛔' },
  { type: 'SAILS_DOWN', label: 'Sails Down', icon: '🪝' },
  { type: 'ANCHOR_DROPPED', label: 'Anchor Dropped', icon: '⚓' },
  { type: 'ANCHOR_WEIGHED', label: 'Anchor Weighed', icon: '🚤' },
  { type: 'MOORED', label: 'Moored', icon: '🧷' },
  { type: 'CAST_OFF', label: 'Cast Off', icon: '🌊' },
  { type: 'END_TRIP', label: 'End Trip', icon: '🏁' },
  { type: 'NOTE', label: 'Note', icon: '📝' },
  { type: 'HOURLY_LOG', label: 'Hourly Log', icon: '🕐' },
  { type: 'PHOTO', label: 'Photo', icon: '📷' },
  { type: 'VOICE_NOTE', label: 'Voice Note', icon: '🎙️' },
]

export const NAVIGATION_EVENT_TYPES = EVENT_TYPES.filter((event) =>
  [
    'START_TRIP',
    'SAILS_UP',
    'ENGINE_ON',
    'ENGINE_OFF',
    'SAILS_DOWN',
    'ANCHOR_DROPPED',
    'ANCHOR_WEIGHED',
    'MOORED',
    'CAST_OFF',
    'END_TRIP',
  ].includes(event.type),
)

export const OPERATIONAL_STATUS_ENTRY_TYPES: LogEntryType[] = [
  'CAST_OFF',
  'SAILS_UP',
  'SAILS_DOWN',
  'ENGINE_ON',
  'ENGINE_OFF',
  'MOORED',
  'ANCHOR_DROPPED',
  'ANCHOR_WEIGHED',
  'END_TRIP',
]

export function entryTitle(type: LogEntryType) {
  return EVENT_TYPES.find((event) => event.type === type)?.label ?? type
}

export function entryIcon(type: LogEntryType) {
  return EVENT_TYPES.find((event) => event.type === type)?.icon ?? '•'
}

const LOG_ENTRY_NAVIGATION_ORDER: LogEntryType[] = [
  'CAST_OFF',
  'HOURLY_LOG',
  'ANCHOR_WEIGHED',
  'SAILS_UP',
  'SAILS_DOWN',
  'ENGINE_ON',
  'ENGINE_OFF',
  'ANCHOR_DROPPED',
  'MOORED',
]

const LOG_ENTRY_GENERAL_ORDER: LogEntryType[] = [
  'NOTE',
  'PHOTO',
  'VOICE_NOTE',
]

function logEntryTypeSortKey(
  type: LogEntryType,
  state: TripOperationalState,
  entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
) {
  if (type === 'START_TRIP') return 0
  if (type === 'END_TRIP') return 10_000
  if (type === 'CAST_OFF' && needsCastOff(state, entries)) return 100
  if (type === 'ANCHOR_WEIGHED' && state.anchorDown === true) return 100

  const navigationIndex = LOG_ENTRY_NAVIGATION_ORDER.indexOf(type)
  if (navigationIndex >= 0) return 200 + navigationIndex

  const generalIndex = LOG_ENTRY_GENERAL_ORDER.indexOf(type)
  if (generalIndex >= 0) return 500 + generalIndex

  return 900
}

type TripLogContext = Pick<
  Trip,
  'status' | 'sailsUp' | 'engineOn' | 'moored' | 'anchorDown'
>

export function isLogEntryTypeVisible(
  type: LogEntryType,
  trip: TripLogContext,
  entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
) {
  const state = resolveTripOperationalState(trip, entries)
  const hasStartTripEntry = entries.some(
    (entry) => !entry.deleted && entry.type === 'START_TRIP',
  )

  switch (type) {
    case 'START_TRIP':
      return !state.inProgress && !hasStartTripEntry
    case 'END_TRIP':
      return state.inProgress && trip.status !== 'COMPLETED'
    case 'SAILS_UP':
      return state.inProgress && state.sailsUp === false
    case 'SAILS_DOWN':
      return state.inProgress && state.sailsUp === true
    case 'ENGINE_ON':
      return state.inProgress && state.engineOn !== true
    case 'ENGINE_OFF':
      return state.inProgress && state.engineOn === true
    case 'MOORED':
      return state.inProgress && state.moored !== true
    case 'ANCHOR_DROPPED':
      return state.inProgress && state.anchorDown !== true
    case 'CAST_OFF':
      return state.inProgress && needsCastOff(state, entries)
    case 'ANCHOR_WEIGHED':
      return state.inProgress && state.anchorDown === true
    default:
      return true
  }
}

export function visibleLogEntryTypes(
  trip: TripLogContext,
  entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
) {
  const state = resolveTripOperationalState(trip, entries)

  return LOG_ENTRY_TYPES.filter((type) =>
    isLogEntryTypeVisible(type, trip, entries),
  ).sort(
    (a, b) =>
      logEntryTypeSortKey(a, state, entries) -
      logEntryTypeSortKey(b, state, entries),
  )
}

export function isLogEntryTypeDisabled(
  type: LogEntryType,
  trip: TripLogContext,
  entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
) {
  return !isLogEntryTypeVisible(type, trip, entries)
}
