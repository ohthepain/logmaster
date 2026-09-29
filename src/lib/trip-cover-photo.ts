import { toast } from 'sonner'
import { useLogbookStore } from '../stores/logbook'
import { readImageFile } from './image-file'

export function canUseImageAsTripCover(src: string): boolean {
  if (src.startsWith('data:video/')) return false
  if (/\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(src)) return false
  return true
}

export async function coverPhotoDataUrlFromBlob(blob: Blob): Promise<string> {
  if (blob.type && !blob.type.startsWith('image/')) {
    throw new Error('This file is not a photo')
  }
  return readImageFile(
    new File([blob], 'cover', { type: blob.type || 'image/jpeg' }),
  )
}

export async function coverPhotoDataUrlFromSrc(src: string): Promise<string> {
  if (src.startsWith('data:image/')) return src
  if (src.startsWith('data:')) throw new Error('This file is not a photo')
  const response = await fetch(src, { credentials: 'same-origin' })
  if (!response.ok) throw new Error('Could not load this photo')
  return coverPhotoDataUrlFromBlob(await response.blob())
}

export async function applyTripCoverPhoto(
  tripId: string,
  source: Blob | string,
): Promise<void> {
  await useLogbookStore.getState().load()
  const trip = useLogbookStore
    .getState()
    .trips.find((item) => item.id === tripId)
  if (!trip) throw new Error('Trip not found')
  const coverPhotoDataUrl =
    typeof source === 'string'
      ? await coverPhotoDataUrlFromSrc(source)
      : await coverPhotoDataUrlFromBlob(source)
  await useLogbookStore.getState().updateTrip(tripId, {
    coverKind: 'photo',
    coverPhotoDataUrl,
  })
}

export async function setEntryPhotoAsCover(tripId: string, src: string) {
  try {
    await applyTripCoverPhoto(tripId, src)
    toast.success('Trip cover updated')
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : 'Could not set the trip cover',
    )
  }
}
