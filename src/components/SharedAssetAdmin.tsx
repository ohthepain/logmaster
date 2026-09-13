import { useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { searchSharedProducts } from '../lib/product-catalog-api'
import type { ProductAdminSearch } from '../lib/product-catalog-api'
import { SharedAssetPanel } from './SharedAssetPanel'

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
              <ul className="m-0 list-none space-y-2 p-0">
                {result.products.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(product.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left hover:bg-[var(--chip-bg)] focus-visible:outline-2 focus-visible:outline-[var(--sea-accent)]"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {product.brand} {product.modelNumber}
                        </span>
                        {product.name && (
                          <span className="mt-1 block text-sm">
                            {product.name}
                          </span>
                        )}
                        <span className="mt-2 block text-xs text-[var(--sea-ink-soft)]">
                          {product.reviewStatus} · {product.resourceCount}{' '}
                          sources/files ·{' '}
                          {product.languages.join(', ') ||
                            'No researched languages'}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 shrink-0" />
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
