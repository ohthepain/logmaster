import { describe, expect, it } from 'vitest'
import {
  decodeAisStreamWebSocketMessage,
  expandAisSubscriptionBbox,
  splitAisSubscriptionBoxes,
  waitForAisVesselAccumulation,
} from './aisstream-utils'

describe('decodeAisStreamWebSocketMessage', () => {
  it('decodes UTF-8 strings directly', async () => {
    await expect(decodeAisStreamWebSocketMessage('{"ok":true}')).resolves.toBe('{"ok":true}')
  })

  it('decodes Blob payloads from Node WebSocket', async () => {
    const blob = new Blob(['{"MessageType":"PositionReport"}'], {
      type: 'application/json',
    })
    await expect(decodeAisStreamWebSocketMessage(blob)).resolves.toBe(
      '{"MessageType":"PositionReport"}',
    )
  })

  it('decodes ArrayBuffer payloads', async () => {
    const buffer = new TextEncoder().encode('{"MessageType":"PositionReport"}')
    await expect(decodeAisStreamWebSocketMessage(buffer.buffer)).resolves.toBe(
      '{"MessageType":"PositionReport"}',
    )
  })
})

describe('expandAisSubscriptionBbox', () => {
  it('expands tight zoom-13 viewports for richer AIS subscriptions', () => {
    const expanded = expandAisSubscriptionBbox({
      north: 50.92,
      south: 50.84,
      east: -1.32,
      west: -1.44,
    })
    expect(expanded.north - expanded.south).toBeGreaterThan(0.15)
    expect(expanded.east - expanded.west).toBeGreaterThan(0.15)
  })
})

describe('splitAisSubscriptionBoxes', () => {
  it('tiles large zoom-8 viewports like Gotland into multiple AIS boxes', () => {
    const boxes = splitAisSubscriptionBoxes({
      north: 59.5,
      south: 55.0,
      east: 23.0,
      west: 15.5,
    })
    expect(boxes.length).toBeGreaterThan(1)
    expect(boxes.length).toBeLessThanOrEqual(12)
  })
})

describe('waitForAisVesselAccumulation', () => {
  it('waits for the count to settle instead of returning after the first vessel', async () => {
    const timeline = [0, 0, 1, 2, 3, 3, 3, 3]
    let index = 0
    const started = Date.now()
    const count = await waitForAisVesselAccumulation(
      { north: 1, south: 0, east: 1, west: 0 },
      () => timeline[Math.min(index++, timeline.length - 1)],
      { timeoutMs: 4000, pollMs: 100, settleMs: 250 },
    )
    expect(count).toBe(3)
    expect(Date.now() - started).toBeGreaterThanOrEqual(450)
  })
})
