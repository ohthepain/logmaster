import { useState } from 'react'
import { findAssetBrand } from '../domain/asset-brands'

export function AssetBrandLogo({
  brand,
  prominent = false,
}: {
  brand: string | null | undefined
  prominent?: boolean
}) {
  const known = findAssetBrand(brand)
  const [failed, setFailed] = useState<string | null>(null)
  if (!brand) return null
  if (!known?.logo || failed === known.logo) {
    return (
      <span
        className={
          prominent
            ? 'text-2xl font-bold text-[var(--sea-ink)]'
            : 'text-sm font-semibold text-[var(--sea-ink-soft)]'
        }
      >
        {known?.name ?? brand}
      </span>
    )
  }
  return (
    <img
      src={known.logo}
      alt={known.name}
      onError={() => setFailed(known.logo)}
      className={`asset-brand-logo${known.whiteLogo ? ' asset-brand-logo--white' : ''} block ${prominent ? 'h-9 max-w-48' : 'h-7 max-w-36'} w-auto object-contain object-left`}
    />
  )
}
