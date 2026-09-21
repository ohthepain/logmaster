import { cn } from '../lib/cn'
import { assetDisplayImageSrc } from '../lib/asset-cover-photo'
import type { AssetCoverPhoto as AssetCoverPhotoType } from '../domain/boat-assets'

type AssetCoverPhotoProps = {
  cover: AssetCoverPhotoType | null | undefined
  productImageUrl?: string | null
  alt: string
  variant: 'list' | 'detail' | 'card'
  className?: string
}

export function AssetCoverPhoto({
  cover,
  productImageUrl,
  alt,
  variant,
  className,
}: AssetCoverPhotoProps) {
  const src = assetDisplayImageSrc(cover, productImageUrl)
  if (!src) return null

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]',
        variant === 'list' && 'size-12',
        variant === 'detail' &&
          'aspect-[4/3] w-full max-w-[11rem] sm:max-w-[12rem]',
        variant === 'card' &&
          'aspect-[4/3] w-full max-w-none rounded-none border-0',
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
