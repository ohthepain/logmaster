import { readImageFile } from './image-file'
import {
  readPhotoGpsFromFile,
  readPhotoTimestampFromFile,
} from './photo-exif-read'

type TripMediaStore = {
  savePhotoVideo: (
    input: {
      tripId: string
      fileName: string
      mimeType: string
      size: number
      thumbnailUrl: string | null
      remoteUrl?: string | null
      capturePosition: { latitude: number; longitude: number } | null
      timestamp?: string
    },
    options?: { skipSync?: boolean },
  ) => Promise<{ entry: unknown; media: unknown; attached: boolean }>
  syncNow: (options?: { skipBootstrap?: boolean }) => Promise<boolean>
}

export type TripMediaUploadResult = {
  saved: number
  attached: number
  skipped: number
}

function isPhotoVideoFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export async function uploadTripMediaFiles(
  store: TripMediaStore,
  tripId: string,
  files: File[],
): Promise<TripMediaUploadResult> {
  let saved = 0
  let attached = 0
  let skipped = 0

  for (const file of files) {
    if (!isPhotoVideoFile(file)) {
      skipped += 1
      continue
    }

    const isVideo = file.type.startsWith('video/')
    const capturePosition = isVideo ? null : await readPhotoGpsFromFile(file)
    const timestamp = isVideo
      ? undefined
      : await readPhotoTimestampFromFile(file)

    let preview: string | null = null
    try {
      preview = isVideo ? URL.createObjectURL(file) : await readImageFile(file)

      const result = await store.savePhotoVideo(
        {
          tripId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          thumbnailUrl: isVideo ? null : preview,
          remoteUrl: isVideo ? preview : null,
          capturePosition,
          timestamp,
        },
        { skipSync: true },
      )

      if (!result.media) {
        skipped += 1
        continue
      }

      saved += 1
      if (result.attached) attached += 1
    } finally {
      if (isVideo && preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
    }
  }

  if (saved > 0) {
    await store.syncNow({ skipBootstrap: true })
  }

  return { saved, attached, skipped }
}

export function tripMediaUploadToastMessage(result: TripMediaUploadResult): string {
  if (result.saved === 0) {
    return result.skipped > 0
      ? 'No supported photos or videos were selected'
      : 'Nothing to upload'
  }

  const noun =
    result.saved === 1 ? '1 item' : `${result.saved} items`
  if (result.attached > 0 && result.attached < result.saved) {
    return `${noun} added (${result.attached} attached to nearby log entries)`
  }
  if (result.attached === result.saved) {
    return result.saved === 1
      ? 'Photo attached to nearby log entry'
      : `${result.saved} items attached to nearby log entries`
  }
  return result.saved === 1 ? 'Photo or video added' : `${result.saved} photos and videos added`
}
