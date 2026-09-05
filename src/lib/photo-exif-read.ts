import piexif from 'piexifjs'
import { readImageFile } from './image-file'

/** EXIF date format: `YYYY:MM:DD HH:MM:SS` in local wall time. */
export function exifDateTimeToIso(dateTime: string): string | undefined {
  const match = dateTime.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return undefined

  const [, year, month, day, hour, minute, second] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

async function loadExifFromFile(file: File) {
  try {
    const dataUrl = await readImageFile(file)
    if (!dataUrl.startsWith('data:image/jpeg')) return null
    return piexif.load(dataUrl)
  } catch {
    return null
  }
}

export async function readPhotoGpsFromFile(
  file: File,
): Promise<{ latitude: number; longitude: number } | null> {
  const exif = await loadExifFromFile(file)
  const gps = exif?.GPS
  if (!gps) return null

  const latRef = gps[piexif.GPSIFD.GPSLatitudeRef]
  const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef]
  const latDms = gps[piexif.GPSIFD.GPSLatitude]
  const lonDms = gps[piexif.GPSIFD.GPSLongitude]
  if (typeof latRef !== 'string' || typeof lonRef !== 'string') return null
  if (!Array.isArray(latDms) || !Array.isArray(lonDms)) return null

  const latitude = piexif.GPSHelper.dmsRationalToDeg(
    latDms as number[][],
    latRef,
  )
  const longitude = piexif.GPSHelper.dmsRationalToDeg(
    lonDms as number[][],
    lonRef,
  )
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

export async function readPhotoTimestampFromFile(
  file: File,
): Promise<string | undefined> {
  const exif = await loadExifFromFile(file)
  if (!exif) return undefined

  const original =
    exif.Exif?.[piexif.ExifIFD.DateTimeOriginal] ??
    exif['0th']?.[piexif.ImageIFD.DateTime]
  if (typeof original !== 'string') return undefined
  return exifDateTimeToIso(original)
}
