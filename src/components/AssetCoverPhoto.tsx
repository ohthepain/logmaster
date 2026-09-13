import { apiUrl } from '../lib/app-origin'
import { cn } from '../lib/cn'
import { assetCoverPhotoSrc } from '../lib/asset-cover-photo'
import type { AssetCoverPhoto as AssetCoverPhotoType } from '../domain/boat-assets'

type AssetCoverPhotoProps = {
  cover: AssetCoverPhotoType | null | undefined
  productImageUrl?: string | null
  alt: string
  variant: 'list' | 'detail'
  className?: string
}

export function AssetCoverPhoto({
  cover,
  productImageUrl,
  alt,
  variant,
  className,
}: AssetCoverPhotoProps) {
  const src = productImageUrl
    ? apiUrl(productImageUrl)
    : assetCoverPhotoSrc(cover)
  if (!src) return null

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]',
        variant === 'list' && 'size-12',
        variant === 'detail' &&
          'aspect-[4/3] w-full max-w-[11rem] sm:max-w-[12rem]',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
