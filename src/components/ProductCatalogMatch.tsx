import { AssetBrandLogo } from './AssetBrandLogo'
import { useTranslation } from '../lib/i18n'
import { useEffect, useState } from 'react'
import type { CatalogProduct } from '../domain/product-catalog'
import { findCatalogProducts } from '../lib/product-catalog-api'
import { apiUrl } from '../lib/app-origin'

export function ProductCatalogMatch({
  brand,
  model,
  language,
  selectedId,
  onSelect,
}: {
  brand: string
  model: string
  language: string
  selectedId: string | null
  onSelect: (product: CatalogProduct) => void
}) {
  const { t } = useTranslation()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    setProducts([])
    setError('')
    if (!brand.trim() || !model.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void findCatalogProducts(brand, model, language, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setProducts(result.products)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('unavailable')
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [brand, model, language])
  if (error)
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {t('productLookupUnavailable')}
      </p>
    )
  if (!products.length) return null
  return (
    <section className="space-y-2" aria-label="Matching catalog products">
      <p className="text-sm font-semibold">{t('productMatches')}</p>
      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          aria-pressed={selectedId === product.id}
          onClick={() => onSelect(product)}
          className="flex w-full items-center gap-3 border-b border-[var(--chip-line)] py-3 text-left"
        >
          {product.imageUrl && (
            <img
              src={apiUrl(product.imageUrl)}
              alt=""
              className="h-12 w-16 object-contain"
            />
          )}
          <span className="min-w-0 space-y-1">
            <AssetBrandLogo brand={product.brand} />
            <strong className="break-words">{product.modelNumber}</strong>
            <br />
            <span className="text-sm">
              {product.info?.name ?? t('productPending')}
            </span>
            <br />
            <span className="text-xs text-[var(--sea-ink-soft)]">
              {selectedId === product.id
                ? t('productSelected')
                : t('productUse')}{' '}
              ·{' '}
              {product.reviewStatus === 'verified'
                ? t('productReviewed')
                : t('productUnreviewed')}
            </span>
          </span>
        </button>
      ))}
    </section>
  )
}
