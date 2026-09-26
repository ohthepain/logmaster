import { registerPlugin } from '@capacitor/core'
import { getNativePlatform } from '../platform'

export type RecentPhotoThumbnail = {
  localIdentifier: string
  thumbnailBase64: string
}

type LogmasterRecentPhotosPlugin = {
  listRecentPhotos(options?: { limit?: number }): Promise<{
    photos: RecentPhotoThumbnail[]
  }>
  loadRecentPhoto(options: {
    localIdentifier: string
  }): Promise<{ base64: string; format: string }>
}

const NativeRecentPhotos = registerPlugin<LogmasterRecentPhotosPlugin>(
  'LogmasterRecentPhotos',
)

export function supportsRecentPhotoPickerSheet() {
  return getNativePlatform() === 'ios'
}

export async function listRecentPhotoThumbnails(limit = 60) {
  if (!supportsRecentPhotoPickerSheet()) {
    return [] as RecentPhotoThumbnail[]
  }
  const { photos } = await NativeRecentPhotos.listRecentPhotos({ limit })
  return photos ?? []
}

export async function loadRecentPhotoFile(localIdentifier: string) {
  return NativeRecentPhotos.loadRecentPhoto({ localIdentifier })
}
