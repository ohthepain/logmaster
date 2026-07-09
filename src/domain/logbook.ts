export const TRIP_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

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
  startedAt: string
  completedAt?: string | null
  startLatitude?: number | null
  startLongitude?: number | null
  startCountry?: string | null
  status: TripStatus
  createdAt: string
  updatedAt: string
}

export type LogEntry = {
  id: string
  tripId: string
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

export function entryTitle(type: LogEntryType) {
  return EVENT_TYPES.find((event) => event.type === type)?.label ?? type
}

export function entryIcon(type: LogEntryType) {
  return EVENT_TYPES.find((event) => event.type === type)?.icon ?? '•'
}
