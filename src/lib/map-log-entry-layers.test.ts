import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import {
  defaultMapLogEntryLayerToggles,
  filterEntriesForMapLogLayers,
  logEntryMapLayerId,
  logEntryMapLayerToggleId,
  mergeMapLogEntryLayerToggles,
} from './map-log-entry-layers'
import { buildLegEntryPointsGeoJson } from './logbook-map-geo'

function entry(
  patch: Partial<LogEntry> & Pick<LogEntry, 'type'>,
): LogEntry {
  return {
    id: 'entry-1',
    tripId: 'trip-1',
    timestamp: '2026-01-01T10:00:00.000Z',
    latitude: 48.1,
    longitude: -123.1,
    accuracy: null,
    heading: null,
    createdBy: 'captain',
    notes: null,
    data: null,
    weather: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    synced: false,
    deleted: false,
    ...patch,
  }
}

describe('map-log-entry-layers', () => {
  it('maps video photo entries to the media toggle group', () => {
    expect(
      logEntryMapLayerId(
        entry({ type: 'PHOTO', data: { mediaType: 'video' } }),
      ),
    ).toBe('VIDEO')
    expect(
      logEntryMapLayerToggleId(
        entry({ type: 'PHOTO', data: { mediaType: 'video' } }),
      ),
    ).toBe('media')
  })

  it('groups anchor and mooring entry types under one toggle', () => {
    expect(logEntryMapLayerToggleId(entry({ type: 'ANCHOR_DROPPED' }))).toBe(
      'anchor-mooring',
    )
    expect(logEntryMapLayerToggleId(entry({ type: 'MOORED' }))).toBe(
      'anchor-mooring',
    )
  })

  it('filters entries by grouped layer toggles', () => {
    const toggles = {
      ...defaultMapLogEntryLayerToggles(),
      log: false,
    }

    const filtered = filterEntriesForMapLogLayers(
      [
        entry({ id: 'hourly', type: 'HOURLY_LOG' }),
        entry({ id: 'note', type: 'NOTE' }),
        entry({ id: 'anchor', type: 'ANCHOR_DROPPED' }),
      ],
      toggles,
    )

    expect(filtered.map((item) => item.id)).toEqual(['anchor'])
  })

  it('migrates legacy per-type toggles into grouped toggles', () => {
    const merged = mergeMapLogEntryLayerToggles({
      HOURLY_LOG: false,
      ANCHOR_DROPPED: false,
      SAILS_UP: true,
    })

    expect(merged.log).toBe(false)
    expect(merged['anchor-mooring']).toBe(false)
    expect(merged.sails).toBe(true)
  })
})

describe('buildLegEntryPointsGeoJson entry layer toggles', () => {
  it('omits hidden entry groups from map markers', () => {
    const geojson = buildLegEntryPointsGeoJson(
      [
        entry({ id: 'hourly', type: 'HOURLY_LOG' }),
        entry({
          id: 'anchor',
          type: 'ANCHOR_DROPPED',
          latitude: 48.2,
          longitude: -123.2,
        }),
        entry({
          id: 'weighed',
          type: 'ANCHOR_WEIGHED',
          latitude: 48.3,
          longitude: -123.3,
        }),
      ],
      [],
      {
        entryLayerToggles: {
          ...defaultMapLogEntryLayerToggles(),
          'anchor-mooring': false,
        },
      },
    )

    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0]?.properties.kind).toBe('hourly-log')
  })
})
