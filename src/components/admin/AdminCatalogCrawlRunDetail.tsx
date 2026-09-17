import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { fetchCatalogCrawlRun } from '../../lib/admin-api'
import { confirmAdminProductPhoto } from '../../lib/product-catalog-api'
import type {
  CatalogCrawlParsedProduct,
  CatalogCrawlProductStatus,
  CatalogCrawlRunDetail,
} from '../../lib/admin-jobs'
import {
  catalogCrawlEffectivePhotoIndex,
  catalogCrawlPhotoNeedsConfirm,
  catalogCrawlProductMatchesQuery,
  catalogCrawlSelectedPhoto,
} from '../../lib/admin-jobs'
import { SharedAssetPanel } from '../SharedAssetPanel'

const STATUS_LABELS: Record<CatalogCrawlProductStatus, string> = {
  imported: 'Imported',
  parsed: 'Parsed only',
  failed: 'Not parsed',
}

const STATUS_STYLES: Record<CatalogCrawlProductStatus, string> = {
  imported: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  parsed: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

type ProductFilter = 'all' | 'new' | CatalogCrawlProductStatus

type AdminCatalogCrawlRunDetailProps = {
  runId: string
}

function formatLimit(value: number | null): string {
  if (value == null) return 'Default'
  return String(value)
}

function CrawlSettingsPanel({ crawl }: { crawl: CatalogCrawlRunDetail }) {
  const settings = crawl.crawlSettings
  const primaryStartUrl = settings.startUrls[0] ?? null

  return (
    <section className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]/40 p-4">
      <h2 className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
        Crawl parameters
      </h2>
      <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
        {settings.scopeLabel}
        {settings.dryRun ? ' · dry run' : ''}
        {settings.provider ? ` · ${settings.provider}` : ''}
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Start URL
          </dt>
          <dd className="m-0 mt-1 break-all text-[var(--sea-ink)]">
            {primaryStartUrl ? (
              <a
                href={primaryStartUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[var(--chip-line)] underline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                {primaryStartUrl}
              </a>
            ) : (
              <span className="text-[var(--sea-ink-soft)]">
                Equipment category seeds
                {settings.startUrls.length === 0
                  ? ' (default listing URLs)'
                  : ''}
              </span>
            )}
          </dd>
          {settings.startUrls.length > 1 ? (
            <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
              +{settings.startUrls.length - 1} more start URL
              {settings.startUrls.length - 1 === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Max pages
          </dt>
          <dd className="m-0 mt-1 text-[var(--sea-ink)]">
            {formatLimit(settings.maxPages)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Max crawl depth
          </dt>
          <dd className="m-0 mt-1 text-[var(--sea-ink)]">
            {settings.maxCrawlDepth != null
              ? settings.maxCrawlDepth
              : 'Not set'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Max products
          </dt>
          <dd className="m-0 mt-1 text-[var(--sea-ink)]">
            {formatLimit(settings.maxProducts)}
          </dd>
        </div>
      </dl>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-[var(--sea-ink)]">
          Page function &amp; config
        </summary>
        <p className="m-0 mt-2 text-[var(--sea-ink-soft)]">
          {settings.pageFunction}
        </p>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] p-3 text-xs text-[var(--sea-ink)]">
          {settings.configJson}
        </pre>
      </details>
    </section>
  )
}

function ProductPhotoCandidates({
  product,
  photoIndex,
  onPhotoIndexChange,
  confirming,
}: {
  product: CatalogCrawlParsedProduct
  photoIndex: number
  onPhotoIndexChange: (index: number) => void
  confirming: boolean
}) {
  const urls = product.imageUrls
  const safeIndex =
    urls.length === 0
      ? 0
      : ((photoIndex % urls.length) + urls.length) % urls.length
  const currentUrl = urls[safeIndex] ?? null
  const currentPhoto = catalogCrawlSelectedPhoto(product, safeIndex)
  const isDefaultPhoto = Boolean(
    currentPhoto?.isCanonical && currentPhoto.reviewStatus === 'verified',
  )

  const shift = (direction: -1 | 1, event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (urls.length <= 1) return
    onPhotoIndexChange((safeIndex + direction + urls.length) % urls.length)
  }

  return (
    <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--chip-bg)]">
      {currentUrl ? (
        <img
          src={currentUrl}
          alt=""
          className="size-full object-contain object-center"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-full items-center justify-center px-3 text-center text-xs text-[var(--sea-ink-soft)]">
          No photo candidates
        </div>
      )}
      {isDefaultPhoto ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white">
          Default photo
        </span>
      ) : null}
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous photo candidate"
            onClick={(event) => shift(-1, event)}
            className="absolute left-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)]/90 text-[var(--sea-ink)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo candidate"
            onClick={(event) => shift(1, event)}
            className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)]/90 text-[var(--sea-ink)] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <span className="pointer-events-none absolute bottom-1 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {safeIndex + 1}/{urls.length}
          </span>
        </>
      ) : null}
      {confirming ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white">
          Saving…
        </span>
      ) : null}
      {product.productId && currentUrl && !currentPhoto ? (
        <p className="pointer-events-none absolute bottom-2 left-2 right-2 m-0 text-center text-[10px] text-[var(--sea-ink-soft)]">
          Re-import crawl to link this image to the catalog
        </p>
      ) : null}
    </div>
  )
}

function CatalogCrawlProductCard({
  product,
  photoIndex,
  onPhotoIndexChange,
  confirmingPhoto,
  confirmPhotoError,
  onConfirmPhoto,
  onOpenProduct,
}: {
  product: CatalogCrawlParsedProduct
  photoIndex: number
  onPhotoIndexChange: (index: number) => void
  confirmingPhoto: boolean
  confirmPhotoError: string | null
  onConfirmPhoto: () => void
  onOpenProduct: (productId: string) => void
}) {
  const title =
    product.brand && product.modelNumber
      ? `${product.brand} ${product.modelNumber}`
      : product.url
  const openable = Boolean(product.productId)
  const selectedPhoto = catalogCrawlSelectedPhoto(product, photoIndex)
  const needsConfirm = catalogCrawlPhotoNeedsConfirm(product, photoIndex)
  const isDefaultPhoto = Boolean(
    selectedPhoto?.isCanonical && selectedPhoto.reviewStatus === 'verified',
  )

  return (
    <li>
      <article
        className={`flex h-full flex-col gap-2 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]/60 p-3 ${
          openable
            ? 'hover:border-[var(--btn-bg)] hover:bg-[var(--chip-bg)]'
            : ''
        }`}
      >
        <ProductPhotoCandidates
          product={product}
          photoIndex={photoIndex}
          onPhotoIndexChange={onPhotoIndexChange}
          confirming={confirmingPhoto}
        />
        {needsConfirm ? (
          <button
            type="button"
            disabled={confirmingPhoto}
            onClick={(event) => {
              event.stopPropagation()
              onConfirmPhoto()
            }}
            className="w-full rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            Confirm photo
          </button>
        ) : isDefaultPhoto ? (
          <p className="m-0 text-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Default catalog photo
          </p>
        ) : null}
        {confirmPhotoError ? (
          <p className="m-0 text-xs text-red-700 dark:text-red-300">
            {confirmPhotoError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!openable}
          onClick={() => {
            if (product.productId) onOpenProduct(product.productId)
          }}
          className={`min-w-0 flex-1 text-left ${
            openable ? 'cursor-pointer' : 'cursor-default opacity-90'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[product.status]}`}
              >
                {STATUS_LABELS[product.status]}
              </span>
              {product.newThisRun ? (
                <span className="inline-flex rounded-full bg-[var(--sea-accent)]/15 px-2 py-0.5 text-xs font-medium text-[var(--sea-accent)]">
                  New
                </span>
              ) : null}
            </div>
            <p className="m-0 mt-1 line-clamp-2 text-sm font-medium text-[var(--sea-ink)]">
              {title}
            </p>
            <p className="m-0 mt-1 line-clamp-2 text-xs text-[var(--sea-ink-soft)]">
              {[
                product.brand && product.modelNumber ? product.url : null,
                product.error,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {!openable && product.status !== 'failed' ? (
              <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                Import this run to open in catalog
              </p>
            ) : null}
          </div>
        </button>
      </article>
    </li>
  )
}

export function AdminCatalogCrawlRunDetail({
  runId,
}: AdminCatalogCrawlRunDetailProps) {
  const [crawl, setCrawl] = useState<CatalogCrawlRunDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('all')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  )
  const [photoIndexByPageId, setPhotoIndexByPageId] = useState<
    Record<string, number>
  >({})
  const [confirmingPageId, setConfirmingPageId] = useState<string | null>(null)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [confirmAllProgress, setConfirmAllProgress] = useState<string | null>(
    null,
  )
  const [photoConfirmErrorByPageId, setPhotoConfirmErrorByPageId] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setErr(null)
    setCrawl(null)
    void fetchCatalogCrawlRun(runId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCrawl(data)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setErr(error instanceof Error ? error.message : 'Request failed')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [runId])

  const applyConfirmedPhoto = (pageId: string, resourceId: string) => {
    setCrawl((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        products: previous.products.map((entry) => {
          if (entry.pageId !== pageId) return entry
          return {
            ...entry,
            canonicalImageId: resourceId,
            photos: entry.photos.map((photo) => ({
              ...photo,
              reviewStatus:
                photo.resourceId === resourceId
                  ? 'verified'
                  : photo.reviewStatus,
              isCanonical: photo.resourceId === resourceId,
            })),
          }
        }),
      }
    })
  }

  const confirmPhotoAtIndex = async (
    product: CatalogCrawlParsedProduct,
    photoIndex: number,
  ) => {
    const photo = catalogCrawlSelectedPhoto(product, photoIndex)
    if (!product.productId || !photo) return false
    if (!catalogCrawlPhotoNeedsConfirm(product, photoIndex)) return true
    setConfirmingPageId(product.pageId)
    setPhotoConfirmErrorByPageId((previous) => {
      const next = { ...previous }
      delete next[product.pageId]
      return next
    })
    try {
      await confirmAdminProductPhoto(product.productId, photo.resourceId)
      applyConfirmedPhoto(product.pageId, photo.resourceId)
      setPhotoIndexByPageId((previous) => {
        const next = { ...previous }
        delete next[product.pageId]
        return next
      })
      return true
    } catch (error) {
      setPhotoConfirmErrorByPageId((previous) => ({
        ...previous,
        [product.pageId]:
          error instanceof Error ? error.message : 'Could not confirm photo',
      }))
      return false
    } finally {
      setConfirmingPageId(null)
    }
  }

  const visible = useMemo(() => {
    if (!crawl) return []
    return crawl.products.filter((product) => {
      if (filter === 'new') {
        if (!product.newThisRun) return false
      } else if (filter !== 'all' && product.status !== filter) {
        return false
      }
      return catalogCrawlProductMatchesQuery(product, query)
    })
  }, [crawl, filter, query])

  const photoIndexFor = (product: CatalogCrawlParsedProduct) =>
    catalogCrawlEffectivePhotoIndex(product, photoIndexByPageId)

  const confirmAllTargets = useMemo(() => {
    return visible.filter((product) =>
      catalogCrawlPhotoNeedsConfirm(product, photoIndexFor(product)),
    )
  }, [visible, photoIndexByPageId])

  const confirmAllVisible = async () => {
    if (confirmAllTargets.length === 0 || confirmingAll) return
    setConfirmingAll(true)
    setConfirmAllProgress(null)
    let done = 0
    for (const product of confirmAllTargets) {
      done += 1
      setConfirmAllProgress(`${done} / ${confirmAllTargets.length}`)
      await confirmPhotoAtIndex(product, photoIndexFor(product))
    }
    setConfirmAllProgress(null)
    setConfirmingAll(false)
  }

  const photoBusy = confirmingAll || confirmingPageId !== null

  if (loading) {
    return (
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading crawl…</p>
    )
  }
  if (err) {
    return <p className="m-0 text-sm text-red-700 dark:text-red-300">{err}</p>
  }
  if (!crawl) return null

  const filters: Array<{ id: ProductFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: crawl.products.length },
    { id: 'imported', label: 'Imported', count: crawl.importedCount },
    { id: 'new', label: 'New', count: crawl.newCount },
    {
      id: 'parsed',
      label: 'Parsed only',
      count: crawl.parsedCount - crawl.importedCount,
    },
    { id: 'failed', label: 'Not parsed', count: crawl.failedCount },
  ]

  return (
    <div className="flex flex-col gap-4">
      <CrawlSettingsPanel crawl={crawl} />

      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        {crawl.parsedCount} parsed · {crawl.importedCount} imported this run ·{' '}
        {crawl.newCount} new in catalog
        {crawl.failedCount > 0 ? ` · ${crawl.failedCount} not parsed` : ''}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search parsed products</span>
          <Search
            aria-hidden
            className="absolute left-3 top-3 size-5 text-[var(--sea-ink-soft)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand, model, or URL…"
            className="w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] py-3 pl-10 pr-3"
          />
        </label>
      </div>

      <div
        role="tablist"
        aria-label="Product import status"
        className="flex flex-wrap gap-2"
      >
        {filters.map((item) => {
          const selected = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border border-[var(--btn-bg)] bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]'
              }`}
            >
              {item.label} ({item.count})
            </button>
          )
        })}
      </div>

      {crawl.products.length === 0 ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          This crawl has no product pages. Listing pages are omitted.
        </p>
      ) : null}

      {crawl.products.length > 0 && visible.length === 0 ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          No products match this search.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]/40 px-3 py-3">
            <p className="m-0 max-w-xl text-sm text-[var(--sea-ink-soft)]">
              Choose a photo on each card, then confirm here. Filters and search
              apply to bulk confirm.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {confirmAllProgress ? (
                <span className="text-sm text-[var(--sea-ink-soft)]">
                  Confirming {confirmAllProgress}…
                </span>
              ) : null}
              <button
                type="button"
                disabled={confirmAllTargets.length === 0 || photoBusy}
                onClick={() => void confirmAllVisible()}
                className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
              >
                Confirm all visible
                {confirmAllTargets.length > 0
                  ? ` (${confirmAllTargets.length})`
                  : ''}
              </button>
            </div>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product) => (
              <CatalogCrawlProductCard
                key={product.pageId}
                product={product}
                photoIndex={photoIndexFor(product)}
                onPhotoIndexChange={(index) =>
                  setPhotoIndexByPageId((previous) => ({
                    ...previous,
                    [product.pageId]: index,
                  }))
                }
                confirmingPhoto={confirmingPageId === product.pageId}
                confirmPhotoError={
                  photoConfirmErrorByPageId[product.pageId] ?? null
                }
                onConfirmPhoto={() =>
                  void confirmPhotoAtIndex(product, photoIndexFor(product))
                }
                onOpenProduct={setSelectedProductId}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {selectedProductId ? (
        <SharedAssetPanel
          key={selectedProductId}
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onSaved={() => setSelectedProductId(null)}
        />
      ) : null}
    </div>
  )
}
