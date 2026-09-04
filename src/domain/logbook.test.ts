import { describe, expect, it } from 'vitest'
import {
  isLogEntryTypeDisabled,
  isLogEntryTypeVisible,
  visibleLogEntryTypes,
} from './logbook'
import type { LogEntry, Trip } from './logbook'
import {
  deriveTripOperationalState,
  formatAnchorState,
  formatEngineState,
  formatMooredState,
  formatSailsState,
  isLogEntryTypeStateActive,
  operationalFieldsFromState,
  operationalToggleConfirmPrompt,
  operationalToggleEntryType,
  resolveTripOperationalState,
  syncTripOperationalFields,
  syncTripLifecycleFromEntries,
} from './trip-state'

const plannedTrip: Pick<Trip, 'status'> = { status: 'PLANNED' }
const inProgressTrip: Pick<Trip, 'status'> = { status: 'IN_PROGRESS' }
const completedTrip: Pick<Trip, 'status'> = { status: 'COMPLETED' }

function entry(
  type: LogEntry['type'],
  timestamp: string,
): Pick<LogEntry, 'type' | 'timestamp' | 'deleted'> {
  return { type, timestamp, deleted: false }
}

describe('deriveTripOperationalState', () => {
  it('defaults to marina departure state for an in-progress trip', () => {
    const state = deriveTripOperationalState(inProgressTrip, [])

    expect(state).toEqual({
      inProgress: true,
      sailsUp: false,
      engineOn: null,
      moored: true,
      anchorDown: false,
    })
  })

  it('tracks sails, engine, mooring, and anchor from chronological entries', () => {
    const state = deriveTripOperationalState(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('SAILS_UP', '2026-01-01T10:05:00Z'),
      entry('ENGINE_ON', '2026-01-01T10:10:00Z'),
      entry('MOORED', '2026-01-01T18:00:00Z'),
      entry('CAST_OFF', '2026-01-02T08:00:00Z'),
      entry('ANCHOR_DROPPED', '2026-01-02T12:00:00Z'),
      entry('ANCHOR_WEIGHED', '2026-01-02T18:00:00Z'),
      entry('SAILS_DOWN', '2026-01-02T18:05:00Z'),
      entry('ENGINE_OFF', '2026-01-02T18:10:00Z'),
    ])

    expect(state).toEqual({
      inProgress: true,
      sailsUp: false,
      engineOn: false,
      moored: false,
      anchorDown: false,
    })
  })

  it('ends the trip when END_TRIP is logged', () => {
    const state = deriveTripOperationalState(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('END_TRIP', '2026-01-01T18:00:00Z'),
    ])

    expect(state.inProgress).toBe(false)
  })

  it('ignores deleted entries', () => {
    const state = deriveTripOperationalState(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      { type: 'SAILS_UP', timestamp: '2026-01-01T10:05:00Z', deleted: true },
    ])

    expect(state.sailsUp).toBe(false)
    expect(state.moored).toBe(true)
    expect(state.anchorDown).toBe(false)
  })

  it('preserves pre-start settings when START_TRIP is logged', () => {
    const state = deriveTripOperationalState(
      {
        status: 'PLANNED',
        sailsUp: false,
        engineOn: null,
        moored: false,
        anchorDown: false,
      },
      [entry('START_TRIP', '2026-01-01T10:00:00Z')],
    )

    expect(state).toEqual({
      inProgress: true,
      sailsUp: false,
      engineOn: null,
      moored: false,
      anchorDown: false,
    })
  })
})

describe('trip operational persistence helpers', () => {
  it('maps derived state onto trip fields', () => {
    const trip: Trip = {
      id: 'trip-1',
      boatName: 'Boat',
      startedAt: '2026-01-01T10:00:00Z',
      status: 'IN_PROGRESS',
      createdAt: '2026-01-01T10:00:00Z',
      updatedAt: '2026-01-01T10:00:00Z',
    }
    const entries = [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('ENGINE_ON', '2026-01-01T10:05:00Z'),
    ]

    expect(operationalFieldsFromState(deriveTripOperationalState(trip, entries))).toEqual({
      sailsUp: false,
      engineOn: true,
      moored: true,
      anchorDown: false,
    })

    expect(syncTripOperationalFields(trip, entries)).toMatchObject({
      sailsUp: false,
      engineOn: true,
      moored: true,
      anchorDown: false,
    })
  })

  it('derives IN_PROGRESS from START_TRIP even when trip.status is PLANNED', () => {
    const trip: Trip = {
      id: 'trip-1',
      boatName: 'Boat',
      startedAt: '2026-01-01T09:00:00Z',
      status: 'PLANNED',
      createdAt: '2026-01-01T09:00:00Z',
      updatedAt: '2026-01-01T09:00:00Z',
    }

    expect(
      syncTripLifecycleFromEntries(trip, [
        {
          type: 'START_TRIP',
          timestamp: '2026-01-01T10:00:00Z',
          deleted: false,
          latitude: 48.1,
          longitude: -123.1,
        },
      ]),
    ).toMatchObject({
      status: 'IN_PROGRESS',
      startedAt: '2026-01-01T10:00:00Z',
      startLatitude: 48.1,
      startLongitude: -123.1,
    })
  })

  it('reads stored trip fields when entries are unavailable', () => {
    const state = resolveTripOperationalState({
      status: 'IN_PROGRESS',
      sailsUp: true,
      engineOn: false,
      moored: false,
      anchorDown: true,
    })

    expect(state).toEqual({
      inProgress: true,
      sailsUp: true,
      engineOn: false,
      moored: false,
      anchorDown: true,
    })
  })

  it('uses in-progress defaults when stored trip fields are null', () => {
    expect(resolveTripOperationalState({ status: 'IN_PROGRESS' })).toEqual({
      inProgress: true,
      sailsUp: false,
      engineOn: null,
      moored: true,
      anchorDown: false,
    })
  })

  it('uses departure defaults for planned trips without stored fields', () => {
    expect(resolveTripOperationalState({ status: 'PLANNED' })).toEqual({
      inProgress: false,
      sailsUp: false,
      engineOn: null,
      moored: true,
      anchorDown: false,
    })
  })
})

describe('trip state formatters', () => {
  it('formats unknown values', () => {
    expect(formatSailsState(null)).toBe('Unknown')
    expect(formatEngineState(null)).toBe('Unknown')
    expect(formatMooredState(null)).toBe('Unknown')
    expect(formatAnchorState(null)).toBe('Unknown')
  })
})

describe('isLogEntryTypeStateActive', () => {
  it('marks stateful entry types as active for the current operational state', () => {
    const state = deriveTripOperationalState(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('SAILS_UP', '2026-01-01T10:05:00Z'),
      entry('MOORED', '2026-01-01T18:00:00Z'),
    ])

    expect(isLogEntryTypeStateActive('SAILS_UP', state)).toBe(true)
    expect(isLogEntryTypeStateActive('SAILS_DOWN', state)).toBe(false)
    expect(isLogEntryTypeStateActive('MOORED', state)).toBe(true)
    expect(isLogEntryTypeStateActive('CAST_OFF', state)).toBe(false)
  })
})

describe('operational toggles', () => {
  it('maps switch positions to log entry types', () => {
    expect(operationalToggleEntryType('sails', true)).toBe('SAILS_UP')
    expect(operationalToggleEntryType('sails', false)).toBe('SAILS_DOWN')
    expect(operationalToggleEntryType('moored', false)).toBe('CAST_OFF')
    expect(operationalToggleEntryType('anchor', true)).toBe('ANCHOR_DROPPED')
  })

  it('uses short confirm prompts for each toggle action', () => {
    expect(operationalToggleConfirmPrompt('sails', true)).toBe('Raise sails?')
    expect(operationalToggleConfirmPrompt('sails', false)).toBe('Drop sails?')
    expect(operationalToggleConfirmPrompt('engine', true)).toBe('Start engine?')
    expect(operationalToggleConfirmPrompt('engine', false)).toBe('Stop engine?')
    expect(operationalToggleConfirmPrompt('moored', true)).toBe('Tie up?')
    expect(operationalToggleConfirmPrompt('moored', false)).toBe('Cast off?')
    expect(operationalToggleConfirmPrompt('anchor', true)).toBe('Drop anchor?')
    expect(operationalToggleConfirmPrompt('anchor', false)).toBe('Weigh anchor?')
  })
})

describe('isLogEntryTypeVisible', () => {
  it('shows START_TRIP on a planned trip with no start entry', () => {
    expect(isLogEntryTypeVisible('START_TRIP', plannedTrip, [])).toBe(true)
  })

  it('hides START_TRIP once the trip is in progress', () => {
    expect(isLogEntryTypeVisible('START_TRIP', inProgressTrip, [])).toBe(false)
  })

  it('hides START_TRIP when a start entry already exists', () => {
    expect(
      isLogEntryTypeVisible('START_TRIP', plannedTrip, [
        entry('START_TRIP', '2026-01-01T10:00:00Z'),
      ]),
    ).toBe(false)
  })

  it('hides contradictory sail and engine entries', () => {
    const entries = [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('SAILS_UP', '2026-01-01T10:05:00Z'),
      entry('ENGINE_ON', '2026-01-01T10:10:00Z'),
    ]

    expect(isLogEntryTypeVisible('SAILS_UP', inProgressTrip, entries)).toBe(
      false,
    )
    expect(isLogEntryTypeVisible('SAILS_DOWN', inProgressTrip, entries)).toBe(
      true,
    )
    expect(isLogEntryTypeVisible('SAILS_UP', inProgressTrip, [])).toBe(true)
    expect(isLogEntryTypeVisible('SAILS_DOWN', inProgressTrip, [])).toBe(false)
    expect(isLogEntryTypeVisible('ENGINE_ON', inProgressTrip, entries)).toBe(
      false,
    )
    expect(isLogEntryTypeVisible('ENGINE_OFF', inProgressTrip, entries)).toBe(
      true,
    )
  })

  it('shows cast off before departure and hides it once underway', () => {
    const startedEntries = [entry('START_TRIP', '2026-01-01T10:00:00Z')]

    expect(isLogEntryTypeVisible('CAST_OFF', inProgressTrip, startedEntries)).toBe(
      true,
    )

    const departedEntries = [
      ...startedEntries,
      entry('CAST_OFF', '2026-01-01T10:05:00Z'),
    ]

    expect(
      isLogEntryTypeVisible('CAST_OFF', inProgressTrip, departedEntries),
    ).toBe(false)
  })

  it('shows mooring and anchor entries based on current state', () => {
    const mooredEntries = [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('MOORED', '2026-01-01T18:00:00Z'),
    ]

    expect(isLogEntryTypeVisible('MOORED', inProgressTrip, mooredEntries)).toBe(
      false,
    )
    expect(isLogEntryTypeVisible('CAST_OFF', inProgressTrip, mooredEntries)).toBe(
      true,
    )
    expect(
      isLogEntryTypeVisible('ANCHOR_WEIGHED', inProgressTrip, mooredEntries),
    ).toBe(false)

    const anchoredEntries = [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('CAST_OFF', '2026-01-01T10:05:00Z'),
      entry('ANCHOR_DROPPED', '2026-01-01T18:00:00Z'),
    ]

    expect(
      isLogEntryTypeVisible('ANCHOR_DROPPED', inProgressTrip, anchoredEntries),
    ).toBe(false)
    expect(
      isLogEntryTypeVisible('ANCHOR_WEIGHED', inProgressTrip, anchoredEntries),
    ).toBe(true)
    expect(
      isLogEntryTypeVisible('CAST_OFF', inProgressTrip, anchoredEntries),
    ).toBe(false)
    expect(
      isLogEntryTypeVisible('MOORED', inProgressTrip, anchoredEntries),
    ).toBe(true)
  })

  it('shows cast off when moored even if anchor is down', () => {
    const mooredAndAnchoredEntries = [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('ANCHOR_DROPPED', '2026-01-01T10:30:00Z'),
    ]

    expect(
      isLogEntryTypeVisible('CAST_OFF', inProgressTrip, mooredAndAnchoredEntries),
    ).toBe(true)
    expect(
      isLogEntryTypeVisible('MOORED', inProgressTrip, mooredAndAnchoredEntries),
    ).toBe(false)
  })

  it('uses stored trip fields when entries are omitted', () => {
    expect(
      isLogEntryTypeVisible('ENGINE_ON', {
        status: 'IN_PROGRESS',
        engineOn: true,
      }, []),
    ).toBe(false)
    expect(
      isLogEntryTypeVisible('ENGINE_OFF', {
        status: 'IN_PROGRESS',
        engineOn: true,
      }, []),
    ).toBe(true)
  })

  it('hides END_TRIP when the trip is not in progress', () => {
    expect(isLogEntryTypeVisible('END_TRIP', plannedTrip, [])).toBe(false)
    expect(isLogEntryTypeVisible('END_TRIP', completedTrip, [])).toBe(false)
    expect(
      isLogEntryTypeVisible('END_TRIP', inProgressTrip, [
        entry('START_TRIP', '2026-01-01T10:00:00Z'),
      ]),
    ).toBe(true)
  })

  it('keeps note entries visible', () => {
    expect(isLogEntryTypeVisible('NOTE', inProgressTrip, [])).toBe(true)
  })
})

describe('visibleLogEntryTypes', () => {
  it('orders start trip first on a planned trip', () => {
    expect(visibleLogEntryTypes(plannedTrip, [])[0]).toBe('START_TRIP')
  })

  it('orders cast off first on a newly started trip', () => {
    const types = visibleLogEntryTypes(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
    ])

    expect(types[0]).toBe('CAST_OFF')
    expect(types[1]).toBe('HOURLY_LOG')
    expect(types).not.toContain('START_TRIP')
    expect(types.at(-1)).toBe('END_TRIP')
  })

  it('orders end trip last and hides engine on when the engine is running', () => {
    const types = visibleLogEntryTypes(inProgressTrip, [
      entry('START_TRIP', '2026-01-01T10:00:00Z'),
      entry('CAST_OFF', '2026-01-01T10:05:00Z'),
      entry('ENGINE_ON', '2026-01-01T10:10:00Z'),
    ])

    expect(types).not.toContain('ENGINE_ON')
    expect(types).toContain('ENGINE_OFF')
    expect(types.at(-1)).toBe('END_TRIP')
  })
})

describe('isLogEntryTypeDisabled', () => {
  it('mirrors visibility', () => {
    expect(isLogEntryTypeDisabled('START_TRIP', inProgressTrip, [])).toBe(true)
    expect(isLogEntryTypeDisabled('NOTE', inProgressTrip, [])).toBe(false)
  })
})
