import { describe, expect, it } from 'vitest'
import {
  cachedDegreeTile,
  clearDegreeTileSessionCache,
  degreeViewportAlreadyApplied,
  degreeViewportSignature,
  markDegreeViewportApplied,
  storeDegreeTile,
} from './degree-tile-session-cache'

describe('degree tile session cache', () => {
  it('returns a stored tile without treating a new url as cached', () => {
    clearDegreeTileSessionCache()
    storeDegreeTile('/api/marinas/N49/E12/v1/tiles/marinas.json.gz', {
      type: 'FeatureCollection',
      features: [],
    })

    expect(
      cachedDegreeTile('/api/marinas/N49/E12/v1/tiles/marinas.json.gz'),
    ).toEqual({ type: 'FeatureCollection', features: [] })
    expect(
      cachedDegreeTile('/api/marinas/N49/E13/v1/tiles/marinas.json.gz'),
    ).toBeUndefined()
  })

  it('remembers a viewport that was already drawn', () => {
    clearDegreeTileSessionCache()
    const signature = degreeViewportSignature(['1_12', '0_12'])
    expect(degreeViewportAlreadyApplied('marinas', signature)).toBe(false)
    markDegreeViewportApplied('marinas', signature)
    expect(degreeViewportAlreadyApplied('marinas', signature)).toBe(true)
    expect(degreeViewportAlreadyApplied('marinas', 'other')).toBe(false)
  })
})
