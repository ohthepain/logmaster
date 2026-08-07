import type { LogEntry, LogEntryType, Trip } from './logbook'

export type TripOperationalState = {
  inProgress: boolean
  sailsUp: boolean | null
  engineOn: boolean | null
  moored: boolean | null
  anchorDown: boolean | null
}

export type TripOperationalFields = {
  sailsUp: boolean | null
  engineOn: boolean | null
  moored: boolean | null
  anchorDown: boolean | null
}

/** Assumed marina departure state when a trip is underway. */
export const DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS: TripOperationalFields = {
  sailsUp: false,
  engineOn: null,
  moored: true,
  anchorDown: false,
}

function initialOperationalState(
  trip: Pick<Trip, 'status'>,
): TripOperationalState {
  if (trip.status === 'IN_PROGRESS') {
    return {
      inProgress: true,
      ...DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS,
    }
  }

  return {
    inProgress: false,
    sailsUp: null,
    engineOn: null,
    moored: null,
    anchorDown: null,
  }
}

function applyStartTripDefaults(state: TripOperationalState) {
  state.inProgress = true
  state.sailsUp = DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.sailsUp
  state.moored = DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.moored
  state.anchorDown = DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.anchorDown
}

const STATE_ENTRY_TYPES = new Set<LogEntryType>([
  'START_TRIP',
  'END_TRIP',
  'SAILS_UP',
  'SAILS_DOWN',
  'ENGINE_ON',
  'ENGINE_OFF',
  'MOORED',
  'ANCHOR_DROPPED',
  'CAST_OFF',
  'ANCHOR_WEIGHED',
])

export function deriveTripOperationalState(
  trip: Pick<Trip, 'status'>,
  entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
): TripOperationalState {
  const state = initialOperationalState(trip)

  const sortedEntries = entries
    .filter((entry) => !entry.deleted && STATE_ENTRY_TYPES.has(entry.type))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

  for (const entry of sortedEntries) {
    switch (entry.type) {
      case 'START_TRIP':
        applyStartTripDefaults(state)
        break
      case 'END_TRIP':
        state.inProgress = false
        break
      case 'SAILS_UP':
        state.sailsUp = true
        break
      case 'SAILS_DOWN':
        state.sailsUp = false
        break
      case 'ENGINE_ON':
        state.engineOn = true
        break
      case 'ENGINE_OFF':
        state.engineOn = false
        break
      case 'MOORED':
        state.moored = true
        break
      case 'ANCHOR_DROPPED':
        state.anchorDown = true
        break
      case 'CAST_OFF':
        state.moored = false
        break
      case 'ANCHOR_WEIGHED':
        state.anchorDown = false
        break
    }
  }

  return state
}

export function operationalFieldsFromState(
  state: TripOperationalState,
): TripOperationalFields {
  return {
    sailsUp: state.sailsUp,
    engineOn: state.engineOn,
    moored: state.moored,
    anchorDown: state.anchorDown,
  }
}

export function resolveTripOperationalState(
  trip: Pick<
    Trip,
    'status' | 'sailsUp' | 'engineOn' | 'moored' | 'anchorDown'
  >,
  entries?: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[],
): TripOperationalState {
  if (entries && entries.some((entry) => !entry.deleted)) {
    return deriveTripOperationalState(trip, entries)
  }

  if (trip.status === 'IN_PROGRESS') {
    return {
      inProgress: true,
      sailsUp: trip.sailsUp ?? DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.sailsUp,
      engineOn: trip.engineOn ?? DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.engineOn,
      moored: trip.moored ?? DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.moored,
      anchorDown:
        trip.anchorDown ?? DEFAULT_IN_PROGRESS_OPERATIONAL_FIELDS.anchorDown,
    }
  }

  return {
    inProgress: false,
    sailsUp: trip.sailsUp ?? null,
    engineOn: trip.engineOn ?? null,
    moored: trip.moored ?? null,
    anchorDown: trip.anchorDown ?? null,
  }
}

export function syncTripOperationalFields<
  T extends Pick<Trip, 'status' | 'sailsUp' | 'engineOn' | 'moored' | 'anchorDown'>,
>(trip: T, entries: Pick<LogEntry, 'type' | 'timestamp' | 'deleted'>[]): T {
  const state = deriveTripOperationalState(trip, entries)
  return {
    ...trip,
    ...operationalFieldsFromState(state),
  }
}

export function formatSailsState(sailsUp: boolean | null) {
  if (sailsUp === true) return 'Up'
  if (sailsUp === false) return 'Down'
  return 'Unknown'
}

export function formatEngineState(engineOn: boolean | null) {
  if (engineOn === true) return 'On'
  if (engineOn === false) return 'Off'
  return 'Unknown'
}

export function formatMooredState(moored: boolean | null) {
  if (moored === true) return 'Moored'
  if (moored === false) return 'Not moored'
  return 'Unknown'
}

export function formatAnchorState(anchorDown: boolean | null) {
  if (anchorDown === true) return 'Down'
  if (anchorDown === false) return 'Up'
  return 'Unknown'
}

export function needsCastOff(
  state: TripOperationalState,
  entries: Pick<LogEntry, 'type' | 'deleted'>[],
) {
  if (!state.inProgress) return false
  if (state.moored === true) return true
  if (state.anchorDown === true) return false
  return !entries.some((entry) => !entry.deleted && entry.type === 'CAST_OFF')
}

export function isLogEntryTypeStateActive(
  type: LogEntryType,
  state: TripOperationalState,
) {
  switch (type) {
    case 'SAILS_UP':
      return state.sailsUp === true
    case 'SAILS_DOWN':
      return state.sailsUp === false
    case 'ENGINE_ON':
      return state.engineOn === true
    case 'ENGINE_OFF':
      return state.engineOn === false
    case 'MOORED':
      return state.moored === true
    case 'ANCHOR_DROPPED':
      return state.anchorDown === true
    case 'ANCHOR_WEIGHED':
      return state.anchorDown === false
    default:
      return false
  }
}

export type OperationalToggle = 'sails' | 'engine' | 'moored' | 'anchor'

export const OPERATIONAL_TOGGLES: OperationalToggle[] = [
  'sails',
  'engine',
  'moored',
  'anchor',
]

export function operationalToggleLabel(toggle: OperationalToggle) {
  switch (toggle) {
    case 'sails':
      return 'Sails'
    case 'engine':
      return 'Engine'
    case 'moored':
      return 'Moored'
    case 'anchor':
      return 'Anchor'
  }
}

export function operationalToggleSideLabels(toggle: OperationalToggle) {
  switch (toggle) {
    case 'sails':
      return { left: 'Down', right: 'Up' }
    case 'engine':
      return { left: 'Off', right: 'On' }
    case 'moored':
      return { left: 'Away', right: 'Moored' }
    case 'anchor':
      return { left: 'Up', right: 'Down' }
  }
}

export function isOperationalToggleOn(
  toggle: OperationalToggle,
  state: TripOperationalState,
) {
  switch (toggle) {
    case 'sails':
      return state.sailsUp === true
    case 'engine':
      return state.engineOn === true
    case 'moored':
      return state.moored === true
    case 'anchor':
      return state.anchorDown === true
  }
}

export function operationalToggleOnAtTop(toggle: OperationalToggle): boolean {
  return toggle !== 'anchor'
}

export function operationalToggleEntryType(
  toggle: OperationalToggle,
  targetOn: boolean,
): LogEntryType {
  switch (toggle) {
    case 'sails':
      return targetOn ? 'SAILS_UP' : 'SAILS_DOWN'
    case 'engine':
      return targetOn ? 'ENGINE_ON' : 'ENGINE_OFF'
    case 'moored':
      return targetOn ? 'MOORED' : 'CAST_OFF'
    case 'anchor':
      return targetOn ? 'ANCHOR_DROPPED' : 'ANCHOR_WEIGHED'
  }
}
