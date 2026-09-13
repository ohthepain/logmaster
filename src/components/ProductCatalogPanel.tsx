import { startAssetResearchJob } from '../lib/boat-assets-api'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '../lib/i18n'
import { fetchCatalogProduct } from '../lib/product-catalog-api'
import { apiUrl } from '../lib/app-origin'
import { openBoatDocument } from '../lib/boat-document-open'
import type { BoatDocumentViewerPayload } from '../lib/boat-document-open'
import type { CatalogProduct } from '../domain/product-catalog'
import { BoatDocumentViewerModal } from './BoatDocumentViewerModal'

export function ProductCatalogPanel({
  productId,
  boatId,
  assetId,
  onResearchStarted,
  researchActive = false,
}: {
  productId: string
  boatId: string
  assetId: string
  onResearchStarted: () => void
  researchActive?: boolean
}) {
  const { language, t } = useTranslation()
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [viewer, setViewer] = useState<BoatDocumentViewerPayload | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setProduct(null)
    setError('')
    const load = () =>
      void fetchCatalogProduct(productId, language, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setProduct(result)
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('unavailable')
        })
    load()
    const timer = researchActive ? setInterval(load, 3000) : null
    return () => {
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [productId, language, researchActive])
  if (error) return <p className="text-sm">{t('productUnavailable')}</p>
  if (!product) return <p className="text-sm">{t('productLoading')}</p>
  return (
    <section className="mb-6 space-y-3" aria-label="Shared product information">
      <h2 className="text-lg font-semibold">{t('productInformation')}</h2>
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {product.reviewStatus === 'verified'
          ? t('productReviewedInfo')
          : t('productCandidateInfo')}
      </p>
      {product.imageUrl && (
        <img
          src={apiUrl(product.imageUrl)}
          alt={`${product.brand} ${product.modelNumber}`}
          className="max-h-56 max-w-full object-contain"
        />
      )}
      {product.researchStatus !== 'completed' && (
        <button
          type="button"
          disabled={researchActive || starting}
          className="rounded-full border border-[var(--chip-line)] px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => {
            setStarting(true)
            void startAssetResearchJob(boatId, {
              assetId,
              productId,
              brand: product.brand,
              modelNumber: product.modelNumber,
              name: product.modelNumber,
              description: '',
              language,
            })
              .then(onResearchStarted)
              .catch((e) => toast.error(e.message))
              .finally(() => setStarting(false))
          }}
        >
          {researchActive || starting
            ? t('productFinding')
            : t('productFindLocalized', { language: language.toUpperCase() })}
        </button>
      )}
      {product.info ? (
        <>
          <h3 className="font-semibold">{product.info.name}</h3>
          {product.language !== language && (
            <p className="text-xs">
              {t('productLanguageFallback', {
                language: product.language.toUpperCase(),
              })}
            </p>
          )}
          <p className="whitespace-pre-line text-sm">
            {product.info.description}
          </p>
          {!!product.info.specifications.length && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {product.info.specifications.map((spec, i) => (
                <div key={i}>
                  <dt className="text-[var(--sea-ink-soft)]">{spec.name}</dt>
                  <dd>
                    {spec.value} {spec.unit}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {product.info.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {source.title}
              </a>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm">{t('productResearchPending')}</p>
      )}
      {product.resources
        .filter((r) => r.purpose !== 'photo')
        .map((resource) => (
          <div
            key={resource.id}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <button
              type="button"
              className="underline"
              onClick={() =>
                void openBoatDocument(
                  {
                    title: resource.title,
                    kind: 'upload',
                    mimeType: 'application/pdf',
                    fileName: `${resource.id}.pdf`,
                    url: null,
                    contentUrl: resource.contentUrl,
                  },
                  { onOpenViewer: setViewer },
                ).catch((e) => toast.error(e.message))
              }
            >
              {resource.title}
            </button>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              {resource.languages.length
                ? resource.languages.join(', ').toUpperCase()
                : t('productLanguageUnknown')}
              {resource.revision ? ` · ${resource.revision}` : ''}
              {resource.reviewStatus !== 'verified'
                ? ` · ${t('productUnreviewed')}`
                : ''}
            </span>
            <a
              href={resource.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline"
            >
              {t('productSource')}
            </a>
          </div>
        ))}
      {viewer && (
        <BoatDocumentViewerModal {...viewer} onClose={() => setViewer(null)} />
      )}
    </section>
  )
}
