import piexif from 'piexifjs'

export type PhotoExifStampInput = {
  timestampIso: string
  latitude?: number | null
  longitude?: number | null
}

export type PhotoMetadataFromLogEntryInput = {
  entryTimestamp: string
  entryLatitude?: number | null
  entryLongitude?: number | null
  draftPosition?: { latitude: number; longitude: number } | null
  /** When false, saved entry coordinates win over draft/GPS. */
  positionEdited?: boolean
  timestampOverride?: string
}

/** Stamp photos with log-entry time and position, not live GPS/dev fallback. */
export function photoMetadataFromLogEntry(
  args: PhotoMetadataFromLogEntryInput,
): PhotoExifStampInput {
  const useDraft =
    args.positionEdited === true &&
    args.draftPosition != null &&
    Number.isFinite(args.draftPosition.latitude) &&
    Number.isFinite(args.draftPosition.longitude)

  if (useDraft) {
    return {
      timestampIso: args.timestampOverride ?? args.entryTimestamp,
      latitude: args.draftPosition!.latitude,
      longitude: args.draftPosition!.longitude,
    }
  }

  if (
    args.entryLatitude != null &&
    args.entryLongitude != null &&
    Number.isFinite(args.entryLatitude) &&
    Number.isFinite(args.entryLongitude)
  ) {
    return {
      timestampIso: args.timestampOverride ?? args.entryTimestamp,
      latitude: args.entryLatitude,
      longitude: args.entryLongitude,
    }
  }

  if (
    args.draftPosition != null &&
    Number.isFinite(args.draftPosition.latitude) &&
    Number.isFinite(args.draftPosition.longitude)
  ) {
    return {
      timestampIso: args.timestampOverride ?? args.entryTimestamp,
      latitude: args.draftPosition.latitude,
      longitude: args.draftPosition.longitude,
    }
  }

  return {
    timestampIso: args.timestampOverride ?? args.entryTimestamp,
    latitude: null,
    longitude: null,
  }
}

type ExifDictionary = {
  '0th'?: Record<number, string>
  Exif?: Record<number, string>
  GPS?: Record<number, string | number[][]>
}

/** EXIF date format: `YYYY:MM:DD HH:MM:SS` in local wall time. */
export function isoToExifDateTime(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join(':') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function hasGpsCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): latitude is number {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude)
  )
}

export function buildExifBytes(input: PhotoExifStampInput): string | null {
  const dateTime = isoToExifDateTime(input.timestampIso)
  if (!dateTime) return null

  const zeroth: Record<number, string> = {
    [piexif.ImageIFD.Make]: 'logmaster',
    [piexif.ImageIFD.Model]: 'dev exif stamp',
    [piexif.ImageIFD.DateTime]: dateTime,
  }
  const exif: Record<number, string> = {
    [piexif.ExifIFD.DateTimeOriginal]: dateTime,
    [piexif.ExifIFD.DateTimeDigitized]: dateTime,
  }
  const exifObj: ExifDictionary = { '0th': zeroth, Exif: exif }

  if (hasGpsCoordinates(input.latitude, input.longitude)) {
    const { latitude, longitude } = input as {
      latitude: number
      longitude: number
    }
    exifObj.GPS = {
      [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(
        Math.abs(latitude),
      ),
      [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(
        Math.abs(longitude),
      ),
    }
  }

  return piexif.dump(exifObj)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Shell command to stamp the same metadata onto an original file in place. */
export function buildExiftoolCommand(
  input: PhotoExifStampInput,
  filePath: string,
): string | null {
  const dateTime = isoToExifDateTime(input.timestampIso)
  const hasGps = hasGpsCoordinates(input.latitude, input.longitude)
  if (!dateTime && !hasGps) return null

  const parts = ['exiftool', '-overwrite_original']
  if (dateTime) {
    parts.push(`-DateTimeOriginal=${shellQuote(dateTime)}`)
    parts.push(`-CreateDate=${shellQuote(dateTime)}`)
    parts.push(`-ModifyDate=${shellQuote(dateTime)}`)
  }
  if (hasGps) {
    const { latitude, longitude } = input as {
      latitude: number
      longitude: number
    }
    parts.push(
      `-GPSPosition=${shellQuote(`${latitude}, ${longitude}`)}`,
    )
  }
  parts.push(shellQuote(filePath))
  return parts.join(' ')
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode photo'))
    image.src = url
  })
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Could not encode photo as JPEG')
  }
  return dataUrl
}

async function fileToJpegDataUrl(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('Photo file is empty')

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error('Photo has no image data')
    }
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0)
    return canvasToJpegDataUrl(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function binaryStringToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const bytes = jpegDataUrlToBytes(dataUrl)
  const commaIndex = dataUrl.indexOf(',')
  const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg'
  return new File([bytes], fileName, { type: mimeType })
}

/** Decode a JPEG data URL (or piexif binary JPEG string) into bytes. */
export function jpegDataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex >= 0 && dataUrl.startsWith('data:')) {
    const base64 = dataUrl.slice(commaIndex + 1)
    if (!base64) throw new Error('Stamped photo data is empty')
    const binary = atob(base64)
    const bytes = binaryStringToBytes(binary)
    if (bytes.byteLength === 0) throw new Error('Stamped photo data is empty')
    return new Uint8Array(bytes)
  }

  if (dataUrl.charCodeAt(0) === 0xff && dataUrl.charCodeAt(1) === 0xd8) {
    return new Uint8Array(binaryStringToBytes(dataUrl))
  }

  throw new Error('Invalid stamped photo data')
}

function isJpegDataUrl(src: string): boolean {
  return src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')
}

function stampJpegDataUrl(
  dataUrl: string,
  fileName: string,
  input: PhotoExifStampInput,
): { file: File; dataUrl: string } {
  const exifBytes = buildExifBytes(input)
  const stampedDataUrl = exifBytes ? piexif.insert(exifBytes, dataUrl) : dataUrl
  const saveName = stampedFileName(fileName)
  const bytes = jpegDataUrlToBytes(stampedDataUrl)
  const file = new File([bytes], saveName, { type: 'image/jpeg' })
  return { file, dataUrl: stampedDataUrl }
}

export function stampedPhotoSaveName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'photo'
  return `${base}.jpg`
}

function stampedFileName(originalName: string): string {
  return stampedPhotoSaveName(originalName)
}

/**
 * Embeds log-entry time and optional GPS into a JPEG.
 * Non-JPEG inputs (including HEIC from iOS) are decoded via canvas first.
 */
export async function stampPhotoExif(
  file: File,
  input: PhotoExifStampInput,
): Promise<File> {
  const exifBytes = buildExifBytes(input)
  if (!exifBytes) return file

  const jpegDataUrl = await fileToJpegDataUrl(file)
  const stampedDataUrl = piexif.insert(exifBytes, jpegDataUrl)
  return dataUrlToFile(stampedDataUrl, stampedFileName(file.name))
}

async function srcToPhotoFile(src: string, fileName: string): Promise<File> {
  if (src.startsWith('data:')) {
    return dataUrlToFile(src, fileName)
  }

  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Could not load photo (${response.status})`)
  }
  const blob = await response.blob()
  if (blob.size <= 0) throw new Error('Photo file is empty')
  return new File([blob], fileName, {
    type: blob.type || 'image/jpeg',
  })
}

export async function stampPhotoSrc(
  src: string,
  fileName: string,
  input: PhotoExifStampInput,
): Promise<{ file: File; dataUrl: string }> {
  if (isJpegDataUrl(src)) {
    return stampJpegDataUrl(src, fileName, input)
  }

  const stampedFile = await stampPhotoExif(await srcToPhotoFile(src, fileName), input)
  if (stampedFile.size <= 0) {
    throw new Error('Stamped photo is empty')
  }
  const dataUrl = await readStampedFile(stampedFile)
  const bytes = jpegDataUrlToBytes(dataUrl)
  const file = new File([bytes], stampedFile.name, { type: stampedFile.type })
  return { file, dataUrl }
}

async function readStampedFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read stamped photo'))
    }
    reader.onerror = () => reject(new Error('Could not read stamped photo'))
    reader.readAsDataURL(file)
  })
}
