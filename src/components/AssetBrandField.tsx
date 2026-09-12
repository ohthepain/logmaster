import { useId } from 'react'
import { ASSET_BRANDS } from '../domain/asset-brands'
import { AssetBrandLogo } from './AssetBrandLogo'

export function AssetBrandField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="space-y-2">
      <AssetBrandLogo brand={value} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--sea-ink-soft)]">Brand</span>
        <input
          list={id}
          value={value}
          maxLength={100}
          placeholder="Choose or enter a brand"
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 border-0 border-b border-transparent bg-transparent py-1 outline-none focus:border-[var(--sea-ink-soft)]"
        />
      </label>
      <datalist id={id}>
        {ASSET_BRANDS.map((brand) => (
          <option key={brand.id} value={brand.name} />
        ))}
      </datalist>
    </div>
  )
}
