import type { AssetCoverPhoto } from '../domain/boat-assets'
import { apiUrl } from './app-origin'

export function assetCoverPhotoSrc(
  cover: AssetCoverPhoto | null | undefined,
): string | null {
  if (!cover?.contentUrl) return null
  return apiUrl(cover.contentUrl)
}

/** Asset-owned photo first, then linked catalog product image. */
export function assetDisplayImageSrc(
  cover: AssetCoverPhoto | null | undefined,
  productImageUrl?: string | null,
): string | null {
  return (
    assetCoverPhotoSrc(cover) ??
    (productImageUrl ? apiUrl(productImageUrl) : null)
  )
}
