import { describe, expect, it } from 'vitest'
import { exifDateTimeToIso } from './photo-exif-read'

describe('exifDateTimeToIso', () => {
  it('converts EXIF local wall time to ISO', () => {
    const iso = exifDateTimeToIso('2026:08:01 10:20:30')
    expect(iso).toBe(new Date(2026, 7, 1, 10, 20, 30).toISOString())
  })

  it('returns undefined for invalid values', () => {
    expect(exifDateTimeToIso('not-a-date')).toBeUndefined()
  })
})

describe('tripMediaUploadToastMessage', () => {
  it('describes mixed attach and create results', async () => {
    const { tripMediaUploadToastMessage } = await import('./trip-media-upload')
    expect(
      tripMediaUploadToastMessage({ saved: 3, attached: 1, skipped: 0 }),
    ).toBe('3 items added (1 attached to nearby log entries)')
  })
})
