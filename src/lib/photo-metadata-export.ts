import {
  downloadBytes,
  pickStampedPhotoSaveLocation,
  writeStampedPhotoToHandle,
} from './export-file'
import {
  buildExiftoolCommand,
  copyTextToClipboard,
  jpegDataUrlToBytes,
  stampPhotoSrc,
  stampedPhotoSaveName,
  type PhotoExifStampInput,
} from './photo-exif-stamp'

export type PhotoMetadataExportResult = {
  saved: boolean
  exiftoolCopied: boolean
  exiftoolCommand: string | null
  hasGps: boolean
}

export type StampedPhotoMetadataExport = {
  file: File
  dataUrl: string
  exportResult: PhotoMetadataExportResult
}

/**
 * Pick save location while the menu click is still active, stamp EXIF, then write bytes.
 */
export async function stampAndExportPhotoMetadata(
  src: string,
  fileName: string,
  input: PhotoExifStampInput,
  originalPathHint: string,
): Promise<StampedPhotoMetadataExport> {
  const saveFileName = stampedPhotoSaveName(fileName)
  const saveHandle = await pickStampedPhotoSaveLocation(saveFileName)

  const { file, dataUrl } = await stampPhotoSrc(src, fileName, input)
  const bytes = jpegDataUrlToBytes(dataUrl)

  let saved = false
  if (saveHandle) {
    await writeStampedPhotoToHandle(saveHandle, bytes, saveFileName)
    saved = true
  } else {
    saved = downloadBytes(saveFileName, bytes, 'image/jpeg')
  }

  const hasGps =
    typeof input.latitude === 'number' &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.longitude)

  const exiftoolCommand = buildExiftoolCommand(input, originalPathHint)
  const exiftoolCopied = exiftoolCommand
    ? await copyTextToClipboard(exiftoolCommand)
    : false

  return {
    file,
    dataUrl,
    exportResult: { saved, exiftoolCopied, exiftoolCommand, hasGps },
  }
}

export function photoMetadataExportToastMessage(
  result: PhotoMetadataExportResult,
): string {
  if (!result.hasGps && !result.saved && !result.exiftoolCopied) {
    return 'Log entry has no map position — add coordinates before stamping GPS'
  }

  if (result.saved && result.exiftoolCopied) {
    return result.hasGps
      ? 'Stamped photo saved. Exiftool command copied — paste in Terminal to update your original file.'
      : 'Stamped photo saved. Exiftool command copied (time only — entry has no GPS).'
  }

  if (result.saved) {
    return result.hasGps
      ? 'Stamped photo saved with GPS and capture time.'
      : 'Stamped photo saved with capture time (no GPS on this entry).'
  }

  if (result.exiftoolCopied) {
    return 'Exiftool command copied — run it on your original photo file.'
  }

  return 'Could not save stamped photo or copy exiftool command'
}
