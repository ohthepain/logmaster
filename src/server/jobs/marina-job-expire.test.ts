import { describe, expect, it } from 'vitest'
import {
  marinaJobExpireSeconds,
  PG_BOSS_MAX_EXPIRE_SECONDS,
} from './marina-job-expire'

describe('marinaJobExpireSeconds', () => {
  it('allows several hours for Canada quick-test grid size', () => {
    const seconds = marinaJobExpireSeconds({
      region: 'canada',
      gridStep: 3,
    })
    expect(seconds).toBeGreaterThan(8 * 60 * 60)
    expect(seconds).toBeLessThanOrEqual(PG_BOSS_MAX_EXPIRE_SECONDS)
  })

  it('caps North America full grid below pg-boss 24h limit', () => {
    const seconds = marinaJobExpireSeconds({
      region: 'north-america',
      gridStep: 3,
    })
    expect(seconds).toBe(PG_BOSS_MAX_EXPIRE_SECONDS)
    expect(seconds / 60 / 60).toBeLessThan(24)
  })
})
