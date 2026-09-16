import { AssetBrandLogo } from './AssetBrandLogo'
import { useTranslation } from '../lib/i18n'
import { useEffect, useState } from 'react'
import type { CatalogProduct } from '../domain/product-catalog'
import type { EquipmentModelOption } from '../domain/equipment-model-option'
import { findCatalogProducts } from '../lib/product-catalog-api'
import { apiUrl } from '../lib/app-origin'
import { productModelKey } from '../domain/product-catalog'

function productImageSrc(url: string) {
  return /^https?:\/\//i.test(url) ? url : apiUrl(url)
}

function CatalogPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={productImageSrc(src)}
      alt=""
      className="h-12 w-16 shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function SpecPreview({
  specifications,
}: {
  specifications: Array<{ name: string; value: string; unit: string | null }>
}) {
  if (!specifications.length) return null
  return (
    <ul className="mt-1 list-none space-y-0.5 p-0 text-xs text-[var(--sea-ink-soft)]">
      {specifications.slice(0, 4).map((spec) => (
        <li key={`${spec.name}-${spec.value}`}>
          {spec.name}: {spec.value}
          {spec.unit ? ` ${spec.unit}` : ''}
        </li>
      ))}
    </ul>
  )
}

export function ProductCatalogMatch({
  brand,
  model,
  language,
  selectedModelKey,
  onSelectCatalog,
  onSelectSuggested,
  catalogProducts = null,
  suggestedOptions = [],
  loading = false,
}: {
  brand: string
  model: string
  language: string
  selectedModelKey: string | null
  onSelectCatalog: (product: CatalogProduct) => void
  onSelectSuggested?: (option: EquipmentModelOption) => void
  catalogProducts?: CatalogProduct[] | null
  suggestedOptions?: EquipmentModelOption[]
  loading?: boolean
}) {
  const { t } = useTranslation()
  const [fetched, setFetched] = useState<CatalogProduct[]>([])
  const [error, setError] = useState('')
  const products = catalogProducts ?? fetched

  useEffect(() => {
    if (catalogProducts !== null) return
    setFetched([])
    setError('')
    if (!brand.trim() || !model.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void findCatalogProducts(brand, model, language, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setFetched(result.products)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('unavailable')
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [brand, model, language, catalogProducts])

  if (loading) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {t('equipmentLooking')}
      </p>
    )
  }
  if (error)
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {t('productLookupUnavailable')}
      </p>
    )
  if (!products.length && !suggestedOptions.length) return null

  return (
    <section className="space-y-2" aria-label="Matching catalog products">
      <p className="text-sm font-semibold">{t('equipmentPickModel')}</p>
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {t('equipmentPickModelHelp')}
      </p>
      {products.map((product) => {
        const key = productModelKey(product.modelNumber)
        const selected = selectedModelKey === key
        const photo = product.imageUrl || product.previewImageUrl
        return (
          <button
            key={product.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectCatalog(product)}
            className="flex w-full items-start gap-3 border-b border-[var(--chip-line)] py-3 text-left"
          >
            {photo ? <CatalogPhoto src={photo} /> : null}
            <span className="min-w-0 space-y-1">
              <AssetBrandLogo brand={product.brand} />
              <strong className="break-words">{product.modelNumber}</strong>
              <span className="block text-sm">
                {product.info?.name ?? t('productPending')}
              </span>
              <SpecPreview
                specifications={product.info?.specifications ?? []}
              />
              <span className="text-xs text-[var(--sea-ink-soft)]">
                {selected ? t('productSelected') : t('productUse')} ·{' '}
                {product.reviewStatus === 'verified'
                  ? t('productReviewed')
                  : t('productUnreviewed')}
              </span>
            </span>
          </button>
        )
      })}
      {suggestedOptions.map((option) => {
        const key = `${productModelKey(option.brand)}:${productModelKey(option.modelNumber)}`
        const selected =
          selectedModelKey === productModelKey(option.modelNumber)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectSuggested?.(option)}
            className="flex w-full items-start gap-3 border-b border-[var(--chip-line)] py-3 text-left"
          >
            {option.imageUrl ? <CatalogPhoto src={option.imageUrl} /> : null}
            <span className="min-w-0 space-y-1">
              <AssetBrandLogo brand={option.brand || brand} />
              <strong className="break-words">{option.modelNumber}</strong>
              <span className="block text-sm">{option.name}</span>
              {option.description ? (
                <span className="block text-xs text-[var(--sea-ink-soft)]">
                  {option.description}
                </span>
              ) : null}
              <SpecPreview specifications={option.specifications} />
              <span className="text-xs text-[var(--sea-ink-soft)]">
                {selected ? t('productSelected') : t('productUse')}
              </span>
            </span>
          </button>
        )
      })}
    </section>
  )
}
