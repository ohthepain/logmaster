import { languages } from '../../../lib/i18n'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useIsAdmin } from '../../../lib/use-admin'
import { productApi } from '../../../lib/product-catalog-api'
import { apiUrl } from '../../../lib/app-origin'
import type { CatalogProduct } from '../../../domain/product-catalog'

export const Route = createFileRoute('/_main/admin/products')({
  component: ProductAdmin,
})
function ProductAdmin() {
  const { isAdmin, loading } = useIsAdmin()
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [error, setError] = useState('')
  const [all, setAll] = useState(false)
  const [language, setLanguage] = useState('en')
  const reload = useCallback(async () => {
    try {
      setProducts(
        (
          await productApi<{ products: CatalogProduct[] }>(
            `/review?all=${all ? '1' : '0'}&language=${language}`,
          )
        ).products,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load products.')
    }
  }, [all, language])
  useEffect(() => {
    if (isAdmin) void reload()
  }, [isAdmin, reload])
  if (loading) return <main className="page-wrap p-6">Loading…</main>
  if (!isAdmin)
    return <main className="page-wrap p-6">Admin access required.</main>
  return (
    <main className="page-wrap space-y-5 p-6">
      <h1 className="text-2xl font-bold">Product catalog review</h1>
      <p>
        Check the exact variant, source documents and images before approving.
        User photos are never offered here.
      </p>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />
        Include reviewed products (latest 100)
      </label>
      <label className="block">
        Language{' '}
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {languages.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.nativeName}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!products.length && <p>No products to review.</p>}
      {products.map((product) => (
        <ProductReview
          key={`${product.id}:${language}`}
          product={product}
          onSaved={reload}
        />
      ))}
    </main>
  )
}
function ProductReview({
  product,
  onSaved,
}: {
  product: CatalogProduct
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(product.info?.name ?? '')
  const [description, setDescription] = useState(
    product.info?.description ?? '',
  )
  const [alias, setAlias] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function review(input: object) {
    setBusy(true)
    setError('')
    try {
      await productApi(`/${product.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save review.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-[var(--chip-line)] p-4">
      <h2 className="text-xl font-semibold">
        {product.brand} {product.modelNumber}
      </h2>
      <p className="text-sm">
        {product.reviewStatus} · {product.researchStatus}
      </p>
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
        {product.info && (
          <>
            <label className="block">
              Product name
              <input
                className="block w-full rounded border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              Description
              <textarea
                className="block w-full rounded border p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button
              className="underline"
              onClick={() =>
                void review({ name, description, language: product.language })
              }
            >
              Save text
            </button>
            <ul>
              {product.info.specifications.map((spec, i) => (
                <li key={i}>
                  {spec.name}: {spec.value} {spec.unit}
                </li>
              ))}
            </ul>
            {product.info.sources.map((source) => (
              <a
                className="mr-3 inline-block underline"
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
              </a>
            ))}
          </>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded border px-3 py-2"
            disabled={!product.info?.sources.length}
            onClick={() => void review({ status: 'verified' })}
          >
            Approve product
          </button>
          <button
            className="rounded border px-3 py-2"
            onClick={() => void review({ status: 'rejected' })}
          >
            Reject product match
          </button>
          <button
            className="rounded border px-3 py-2"
            onClick={() => void review({ status: 'candidate' })}
          >
            Return to review
          </button>
          <button
            className="rounded border px-3 py-2"
            onClick={() => void review({ imageId: null })}
          >
            Clear shared photo
          </button>
        </div>
        <label className="block">
          Reviewed model alias
          <input
            placeholder="Alternative spelling of this exact model"
            className="ml-2 rounded border p-2"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </label>
        <button
          className="underline"
          disabled={!alias.trim()}
          onClick={() => void review({ alias })}
        >
          Add alias
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          {product.resources.map((resource) => (
            <div
              key={resource.id}
              className="space-y-2 rounded border border-[var(--chip-line)] p-3"
            >
              <strong>{resource.title}</strong>
              <p className="text-xs">
                {resource.languages.join(', ') || 'Language unknown'} ·{' '}
                {resource.reviewStatus} ·{' '}
                {resource.revision ?? 'Revision unknown'}
              </p>
              <p className="text-xs">
                Models:{' '}
                {resource.modelNumbers.join(', ') || 'Check applicability'}
              </p>
              <a
                href={resource.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Manufacturer source
              </a>
              {resource.purpose === 'photo' &&
                resource.reviewStatus !== 'rejected' && (
                  <>
                    <img
                      src={apiUrl(`${resource.contentUrl}?display=1`)}
                      alt={resource.title}
                      loading="lazy"
                      className="h-36 w-full object-contain"
                    />
                    <button
                      className="underline"
                      onClick={() => void review({ imageId: resource.id })}
                    >
                      Use as shared product photo
                    </button>
                  </>
                )}
              <div className="flex gap-3">
                <button
                  className="underline"
                  onClick={() =>
                    void review({
                      resourceId: resource.id,
                      resourceStatus: 'verified',
                    })
                  }
                >
                  Approve source
                </button>
                <button
                  className="underline"
                  onClick={() =>
                    void review({
                      resourceId: resource.id,
                      resourceStatus: 'rejected',
                    })
                  }
                >
                  Reject source
                </button>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
