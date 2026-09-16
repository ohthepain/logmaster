import { describe, expect, it } from 'vitest'
import {
  apifyWaitChunkSeconds,
  buildApifyInput,
  describeApifyInputScope,
  isApifyRunInProgress,
  APIFY_WAIT_FOR_FINISH_MAX_SECONDS,
} from './apify'
import { NAUTICEXPO_MANUFACTURER_PRESETS } from './manufacturers'

describe('buildApifyInput', () => {
  it('defaults to equipment category listings', () => {
    const input = buildApifyInput({ maxProducts: 10, maxPages: 5 })
    expect(input.listingUrls?.length).toBeGreaterThan(0)
    expect(input.manufacturerUrls).toBeUndefined()
    expect(input.maxItems).toBe(10)
  })

  it('targets Victron manufacturer stand when seed is victron-energy', () => {
    const input = buildApifyInput({
      maxProducts: 0,
      maxPages: 50,
      seedProfile: 'victron-energy',
    })
    expect(input.listingUrls).toBeUndefined()
    expect(input.manufacturerUrls).toEqual([
      {
        url: NAUTICEXPO_MANUFACTURER_PRESETS['victron-energy'].manufacturerUrl,
      },
    ])
    expect(input.maxItems).toBe(0)
  })

  it('prefers explicit manufacturer URLs and keywords over category seeds', () => {
    const input = buildApifyInput({
      maxProducts: 100,
      maxPages: 10,
      manufacturerUrls: ['https://www.nauticexpo.com/prod/example-1.html'],
      searchKeywords: ['multiplus'],
    })
    expect(input.listingUrls).toBeUndefined()
    expect(input.manufacturerUrls).toEqual([
      { url: 'https://www.nauticexpo.com/prod/example-1.html' },
    ])
    expect(input.searchKeywords).toEqual(['multiplus'])
  })
})

describe('apifyWaitChunkSeconds', () => {
  it('caps waits at the Apify API maximum', () => {
    expect(apifyWaitChunkSeconds(3_600)).toBe(
      APIFY_WAIT_FOR_FINISH_MAX_SECONDS,
    )
    expect(apifyWaitChunkSeconds(30)).toBe(30)
    expect(apifyWaitChunkSeconds(0)).toBe(1)
  })
})

describe('isApifyRunInProgress', () => {
  it('treats READY and RUNNING as in progress', () => {
    expect(isApifyRunInProgress('READY')).toBe(true)
    expect(isApifyRunInProgress('RUNNING')).toBe(true)
    expect(isApifyRunInProgress('SUCCEEDED')).toBe(false)
    expect(isApifyRunInProgress('FAILED')).toBe(false)
  })
})

describe('describeApifyInputScope', () => {
  it('summarizes manufacturer scope', () => {
    const text = describeApifyInputScope({
      manufacturerUrls: [{ url: 'https://example.com/prod/foo.html' }],
    })
    expect(text).toContain('manufacturer stand')
  })
})
