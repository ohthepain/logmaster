import { useState } from 'react'
import { findAssetBrand } from '../domain/asset-brands'

export function AssetBrandLogo({
  brand,
}: {
  brand: string | null | undefined
}) {
  const known = findAssetBrand(brand)
  const [failed, setFailed] = useState<string | null>(null)
  if (!brand) return null
  if (!known?.logo || failed === known.logo) {
    return (
      <span className="text-sm font-semibold text-[var(--sea-ink-soft)]">
        {known?.name ?? brand}
      </span>
    )
  }
  return (
    <img
      src={known.logo}
      alt={known.name}
      onError={() => setFailed(known.logo)}
      className={`asset-brand-logo${known.whiteLogo ? ' asset-brand-logo--white' : ''} block h-7 w-auto max-w-36 object-contain object-left`}
    />
  )
}
