import { ImageIcon, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ProductAdminSearch } from '../lib/product-catalog-api'
import { searchSharedProducts } from '../lib/product-catalog-api'
import { apiUrl } from '../lib/app-origin'
import { SharedAssetPanel } from './SharedAssetPanel'

const REVIEW_STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  candidate: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

export function SharedAssetAdmin() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<ProductAdminSearch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      void searchSharedProducts(query.trim(), status, page, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setResult(data)
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : 'Search unavailable.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, status, page, revision])
  return (
    <main className="page-wrap space-y-5 px-4 py-8">
      <header>
        <p className="island-kicker">Admin · Product catalog</p>
        <h1 className="text-3xl font-bold">Shared asset information</h1>
        <p className="text-[var(--sea-ink-soft)]">
          Find shared equipment by brand, model, alias, name or description.
          Open a result to review and edit its shared data.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search shared assets</span>
          <Search
            aria-hidden
            className="absolute left-3 top-3 size-5 text-[var(--sea-ink-soft)]"
          />
          <input
            type="search"
            maxLength={200}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Brand, model, alias or description…"
            className="w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] py-3 pl-10 pr-3"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Review status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] p-3"
          >
            <option value="all">All products</option>
            <option value="candidate">Needs review</option>
            <option value="verified">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Searching shared assets…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="underline"
            onClick={() => setRevision((r) => r + 1)}
          >
            Retry search
          </button>
        </div>
      ) : (
        result && (
          <>
            <p role="status" className="text-sm text-[var(--sea-ink-soft)]">
              {result.total} {result.total === 1 ? 'product' : 'products'} found
            </p>
            {!result.products.length ? (
              <p>No shared assets match this search.</p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2 p-0">
                {result.products.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(product.id)}
                      className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] text-left hover:border-[var(--btn-bg)] hover:bg-[var(--chip-bg)] focus-visible:outline-2 focus-visible:outline-[var(--sea-accent)]"
                    >
                      <div className="relative aspect-square w-full bg-[var(--chip-bg)]">
                        {product.imageUrl ? (
                          <img
                            src={apiUrl(product.imageUrl)}
                            alt=""
                            className="size-full object-contain object-center p-1"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-[var(--sea-ink-soft)]">
                            <ImageIcon
                              aria-hidden
                              className="size-5 stroke-[1.5] opacity-60"
                            />
                            No photo
                          </div>
                        )}
                      </div>
                      <span className="flex min-w-0 flex-1 flex-col gap-1 p-2">
                        <span
                          className={`inline-flex w-fit rounded-full px-1.5 py-px text-[10px] font-medium leading-tight ${REVIEW_STATUS_STYLES[product.reviewStatus] ?? REVIEW_STATUS_STYLES.candidate}`}
                        >
                          {product.reviewStatus}
                        </span>
                        <span className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--sea-ink)]">
                          {product.brand} {product.modelNumber}
                        </span>
                        {product.name ? (
                          <span className="line-clamp-1 text-[11px] leading-snug text-[var(--sea-ink-soft)]">
                            {product.name}
                          </span>
                        ) : null}
                        <span className="mt-auto line-clamp-2 text-[10px] leading-snug text-[var(--sea-ink-soft)]">
                          {product.resourceCount} sources ·{' '}
                          {product.languages.join(', ') ||
                            'No researched languages'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <nav
              aria-label="Search results pages"
              className="flex items-center justify-between gap-3"
            >
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border px-4 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm">
                Page {page} of{' '}
                {Math.max(1, Math.ceil(result.total / result.pageSize))}
              </span>
              <button
                type="button"
                disabled={page * result.pageSize >= result.total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border px-4 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          </>
        )
      )}
      {selected && (
        <SharedAssetPanel
          key={selected}
          productId={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setRevision((r) => r + 1)}
        />
      )}
    </main>
  )
}
