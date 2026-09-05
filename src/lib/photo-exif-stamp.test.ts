import { describe, expect, it } from 'vitest'
import { buildExifBytes, buildExiftoolCommand, isoToExifDateTime, jpegDataUrlToBytes, photoMetadataFromLogEntry } from './photo-exif-stamp'

describe('isoToExifDateTime', () => {
  it('formats a UTC instant in local wall time', () => {
    const formatted = isoToExifDateTime('2026-08-01T10:20:30.000Z')
    expect(formatted).toMatch(/^2026:08:01 \d{2}:\d{2}:30$/)
  })

  it('returns null for invalid timestamps', () => {
    expect(isoToExifDateTime('not-a-date')).toBeNull()
  })
})

describe('buildExifBytes', () => {
  it('includes capture time tags', () => {
    const bytes = buildExifBytes({
      timestampIso: '2026-08-01T10:20:30.000Z',
    })
    expect(bytes).not.toBeNull()
    expect(bytes!.length).toBeGreaterThan(0)
  })

  it('includes GPS when coordinates are present', () => {
    const bytes = buildExifBytes({
      timestampIso: '2026-08-01T10:20:30.000Z',
      latitude: 50.763,
      longitude: -1.297,
    })
    expect(bytes).not.toBeNull()
    expect(bytes!.length).toBeGreaterThan(0)
  })

  it('omits GPS when coordinates are missing', () => {
    const withGps = buildExifBytes({
      timestampIso: '2026-08-01T10:20:30.000Z',
      latitude: 50.763,
      longitude: -1.297,
    })
    const withoutGps = buildExifBytes({
      timestampIso: '2026-08-01T10:20:30.000Z',
    })
    expect(withGps!.length).toBeGreaterThan(withoutGps!.length)
  })
})

describe('photoMetadataFromLogEntry', () => {
  it('uses saved entry coordinates when the pin was not edited', () => {
    expect(
      photoMetadataFromLogEntry({
        entryTimestamp: '2026-08-01T10:20:30.000Z',
        entryLatitude: 59.32,
        entryLongitude: 18.06,
        draftPosition: { latitude: 50.7628, longitude: -1.2974 },
        positionEdited: false,
      }),
    ).toEqual({
      timestampIso: '2026-08-01T10:20:30.000Z',
      latitude: 59.32,
      longitude: 18.06,
    })
  })

  it('uses draft position after the user moves the pin', () => {
    expect(
      photoMetadataFromLogEntry({
        entryTimestamp: '2026-08-01T10:20:30.000Z',
        entryLatitude: 59.32,
        entryLongitude: 18.06,
        draftPosition: { latitude: 57.7, longitude: 11.9 },
        positionEdited: true,
      }),
    ).toEqual({
      timestampIso: '2026-08-01T10:20:30.000Z',
      latitude: 57.7,
      longitude: 11.9,
    })
  })
})

describe('buildExiftoolCommand', () => {
  it('builds a command with GPS and capture time', () => {
    const command = buildExiftoolCommand(
      {
        timestampIso: '2026-08-01T10:20:30.000Z',
        latitude: 59.3293,
        longitude: 18.0686,
      },
      '/Users/me/Pictures/photo.heic',
    )
    expect(command).toContain('exiftool')
    expect(command).toContain('-overwrite_original')
    expect(command).toContain('-GPSPosition=')
    expect(command).toContain('59.3293')
    expect(command).toContain('18.0686')
    expect(command).toContain('/Users/me/Pictures/photo.heic')
  })
})

describe('jpeg exif stamp roundtrip', () => {
  it('produces non-empty jpeg bytes after piexif insert', async () => {
    const piexif = (await import('piexifjs')).default
    const tinyJpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAACD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAACD/2gAIAQEAAT8hf//Z'
    const exifBytes = buildExifBytes({
      timestampIso: '2026-08-01T10:20:30.000Z',
      latitude: 59.3293,
      longitude: 18.0686,
    })
    expect(exifBytes).not.toBeNull()
    const stamped = piexif.insert(exifBytes!, tinyJpeg)
    const base64 = stamped.slice(stamped.indexOf(',') + 1)
    expect(base64.length).toBeGreaterThan(0)
    const binary = atob(base64)
    expect(binary.length).toBeGreaterThan(100)
    expect(binary.charCodeAt(0)).toBe(0xff)
    expect(binary.charCodeAt(1)).toBe(0xd8)
    const bytes = jpegDataUrlToBytes(stamped)
    expect(bytes.byteLength).toBeGreaterThan(100)
    expect(bytes[0]).toBe(0xff)
    expect(bytes[1]).toBe(0xd8)
  })
})
