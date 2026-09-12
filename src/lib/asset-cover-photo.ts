import type { AssetCoverPhoto } from '../domain/boat-assets'
import { apiUrl } from './app-origin'

export function assetCoverPhotoSrc(
  cover: AssetCoverPhoto | null | undefined,
): string | null {
  if (!cover?.contentUrl) return null
  return apiUrl(cover.contentUrl)
}
