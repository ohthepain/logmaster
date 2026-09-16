import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './Modal'
import {
  fetchAdminProduct,
  regenerateAdminProduct,
  saveAdminProduct,
} from '../lib/product-catalog-api'
import type {
  ProductAdminDetail,
  ProductAdminEdit,
} from '../domain/product-admin'
import type { ProductInfo } from '../domain/product-catalog'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import { BOAT_NETWORK_DEFINITIONS } from '../domain/asset-connections'
import { apiUrl } from '../lib/app-origin'

const inputClass =
  'w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm'
const buttonClass =
  'rounded-full border border-[var(--chip-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50'
const blankInfo = (): ProductInfo => ({
  name: '',
  description: '',
  category: null,
  specifications: [],
  sources: [],
})
function makeDraft(product: ProductAdminDetail): ProductAdminEdit {
  return {
    updatedAt: product.updatedAt,
    brand: product.brand,
    modelNumber: product.modelNumber,
    reviewStatus: product.reviewStatus,
    canonicalImageId: product.canonicalImageId,
    aliases: product.aliases,
    networkConnections: product.networkConnections ?? [],
    locales: product.locales.flatMap((locale) =>
      locale.info
        ? [
            {
              language: locale.language,
              updatedAt: locale.updatedAt,
              info: locale.info,
            },
          ]
        : [],
    ),
    resources: product.resources.map(
      ({
        id,
        title,
        sourceUrl,
        purpose,
        languages,
        revision,
        modelNumbers,
        reason,
        reviewStatus,
      }) => ({
        id,
        title,
        sourceUrl,
        purpose,
        languages,
        revision,
        modelNumbers,
        reason,
        reviewStatus,
      }),
    ),
  }
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}
function StatusOptions() {
  return (
    <>
      <option value="candidate">Needs review</option>
      <option value="verified">Approved</option>
      <option value="rejected">Rejected</option>
    </>
  )
}
const cleanList = (list: string[]) =>
  list.map((item) => item.trim()).filter(Boolean)

export function SharedAssetPanel({
  productId,
  onClose,
  onSaved,
}: {
  productId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [product, setProduct] = useState<ProductAdminDetail | null>(null)
  const [draft, setDraft] = useState<ProductAdminEdit | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [reload, setReload] = useState(0)
  const [language, setLanguage] = useState('en')
  const [newLanguage, setNewLanguage] = useState('')
  const formId = useId()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void fetchAdminProduct(productId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setProduct(data)
        setDraft(makeDraft(data))
        setDirty(false)
        setLanguage(
          data.locales.some((l) => l.language === 'en')
            ? 'en'
            : (data.locales[0]?.language ?? 'en'),
        )
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Could not load shared data.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [productId, reload])
  function change(next: ProductAdminEdit) {
    setDraft(next)
    setDirty(true)
    setNotice('')
  }
  function close() {
    if (
      !busy &&
      !regenerating &&
      (!dirty || window.confirm('Discard unsaved shared asset changes?'))
    )
      onClose()
  }
  function regenerate() {
    if (!product || busy || regenerating) return
    const confirmed = window.confirm(
      dirty
        ? 'Discard unsaved edits and regenerate AI information? This replaces researched text, specifications, sources, and boat network connections.'
        : 'Regenerate AI information? This replaces researched text, specifications, sources, and boat network connections.',
    )
    if (!confirmed) return
    setRegenerating(true)
    setError('')
    setNotice('')
    void regenerateAdminProduct(product.id, language)
      .then((saved) => {
        setProduct(saved)
        setDraft(makeDraft(saved))
        setDirty(false)
        setNotice(
          'AI information regenerated, including boat network connections.',
        )
        onSaved()
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : 'Could not regenerate AI information.',
        ),
      )
      .finally(() => setRegenerating(false))
  }
  const locale = draft?.locales.find((item) => item.language === language)
  const info = locale?.info
  function changeInfo(next: ProductInfo) {
    if (!draft) return
    change({
      ...draft,
      locales: locale
        ? draft.locales.map((item) =>
            item.language === language ? { ...item, info: next } : item,
          )
        : [
            ...draft.locales,
            {
              language,
              updatedAt:
                product?.locales.find((item) => item.language === language)
                  ?.updatedAt ?? null,
              info: next,
            },
          ],
    })
  }
  function removeResource(index: number) {
    if (!draft) return
    const resource = draft.resources[index]
    if (!resource) return
    if (resource.id) {
      const kind = resource.purpose === 'photo' ? 'photo' : 'document'
      if (
        !window.confirm(
          `Delete this ${kind} from the shared catalog? Save to apply.`,
        )
      )
        return
    }
    change({
      ...draft,
      canonicalImageId:
        resource.id && draft.canonicalImageId === resource.id
          ? null
          : draft.canonicalImageId,
      resources: draft.resources.filter((_, i) => i !== index),
    })
  }
  const localeMeta = product?.locales.find((item) => item.language === language)
  return (
    <Modal
      wide
      closeOnOutside={false}
      title={
        product
          ? `${product.brand} ${product.modelNumber}`
          : 'Shared asset information'
      }
      onClose={close}
      headerActions={
        draft && !loading ? (
          <>
            <button
              type="button"
              disabled={busy || regenerating}
              className={buttonClass}
              onClick={() => regenerate()}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate AI'}
            </button>
            <button
              type="submit"
              form={formId}
              disabled={busy || regenerating || !dirty}
              className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : undefined
      }
      headerBelow={
        <>
          {error && (
            <p role="alert" className="m-0 text-sm text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="m-0 text-sm">
              {notice}
            </p>
          )}
        </>
      }
    >
      {loading ? (
        <p role="status">Loading all shared data…</p>
      ) : !draft || !product ? (
        <button
          type="button"
          className={buttonClass}
          onClick={() => setReload((r) => r + 1)}
        >
          Retry
        </button>
      ) : (
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault()
            if (busy || regenerating) return
            setBusy(true)
            setError('')
            setNotice('')
            const input = {
              ...draft,
              aliases: cleanList(draft.aliases),
              resources: draft.resources.map((resource) => ({
                ...resource,
                languages: cleanList(resource.languages),
                modelNumbers: cleanList(resource.modelNumbers),
              })),
            }
            void saveAdminProduct(product.id, input)
              .then((saved) => {
                setProduct(saved)
                setDraft(makeDraft(saved))
                setDirty(false)
                setNotice('Shared asset information saved.')
                onSaved()
              })
              .catch((e) =>
                setError(
                  e instanceof Error ? e.message : 'Could not save changes.',
                ),
              )
              .finally(() => setBusy(false))
          }}
        >
          <p className="mt-0 text-sm text-[var(--sea-ink-soft)]">
            Changes apply to shared product information used across boats.
            Private photos, notes and installations are separate.
          </p>
          <fieldset
            disabled={busy || regenerating}
            className="m-0 min-w-0 space-y-6 border-0 p-0 disabled:opacity-60"
          >
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Product identity</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Brand">
                  <input
                    required
                    maxLength={100}
                    className={inputClass}
                    value={draft.brand}
                    onChange={(e) =>
                      change({ ...draft, brand: e.target.value })
                    }
                  />
                </Field>
                <Field label="Model number">
                  <input
                    required
                    maxLength={200}
                    className={inputClass}
                    value={draft.modelNumber}
                    onChange={(e) =>
                      change({ ...draft, modelNumber: e.target.value })
                    }
                  />
                </Field>
                <Field label="Product review status">
                  <select
                    className={inputClass}
                    value={draft.reviewStatus}
                    onChange={(e) =>
                      change({ ...draft, reviewStatus: e.target.value })
                    }
                  >
                    <StatusOptions />
                  </select>
                </Field>
                <Field label="Model aliases (one per line)">
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={draft.aliases.join('\n')}
                    onChange={(e) =>
                      change({ ...draft, aliases: e.target.value.split('\n') })
                    }
                  />
                </Field>
              </div>
            </section>
            <section className="space-y-3 border-t border-[var(--line)] pt-3">
              <h2 className="text-lg font-semibold">
                Boat network connections
              </h2>
              <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                Only known boat networks. Transducers, NMEA 0183, Wi-Fi and
                Bluetooth stay in specifications.
              </p>
              {BOAT_NETWORK_DEFINITIONS.map((network) => {
                const current = draft.networkConnections.find(
                  (item) => item.networkKey === network.key,
                )
                return (
                  <div
                    key={network.key}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--sea-ink)]"
                        checked={!!current}
                        onChange={(event) =>
                          change({
                            ...draft,
                            networkConnections: event.target.checked
                              ? [
                                  ...draft.networkConnections,
                                  {
                                    networkKey: network.key,
                                    portCount: null,
                                  },
                                ]
                              : draft.networkConnections.filter(
                                  (item) => item.networkKey !== network.key,
                                ),
                          })
                        }
                      />
                      {network.name}
                    </label>
                    {current ? (
                      <Field label="Ports">
                        <input
                          type="number"
                          min={1}
                          max={32}
                          className={inputClass}
                          value={current.portCount ?? ''}
                          onChange={(event) => {
                            const raw = event.target.value
                            const portCount = raw
                              ? Number.parseInt(raw, 10)
                              : null
                            change({
                              ...draft,
                              networkConnections: draft.networkConnections.map(
                                (item) =>
                                  item.networkKey === network.key
                                    ? {
                                        ...item,
                                        portCount:
                                          portCount && portCount > 0
                                            ? portCount
                                            : null,
                                      }
                                    : item,
                              ),
                            })
                          }}
                        />
                      </Field>
                    ) : null}
                  </div>
                )
              })}
            </section>
            <section className="space-y-3 border-t border-[var(--line)] pt-3">
              <h2 className="text-lg font-semibold">
                Descriptions, specifications and sources
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Content language">
                  <select
                    className={inputClass}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {[
                      ...new Set([
                        'en',
                        ...product.locales.map((item) => item.language),
                        ...draft.locales.map((item) => item.language),
                      ]),
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Add language code">
                  <input
                    className={inputClass}
                    value={newLanguage}
                    placeholder="e.g. sv or de"
                    onChange={(e) => setNewLanguage(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    const code = newLanguage.trim().toLowerCase()
                    if (
                      !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code) ||
                      code.length > 35
                    ) {
                      setError('Enter a language code such as en, sv or de.')
                      return
                    }
                    if (!draft.locales.some((item) => item.language === code))
                      change({
                        ...draft,
                        locales: [
                          ...draft.locales,
                          {
                            language: code,
                            updatedAt:
                              product.locales.find(
                                (item) => item.language === code,
                              )?.updatedAt ?? null,
                            info: blankInfo(),
                          },
                        ],
                      })
                    setLanguage(code)
                    setNewLanguage('')
                    setError('')
                  }}
                >
                  Add language
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                  Research: {localeMeta?.status ?? 'Not researched'}
                  {localeMeta?.researchedAt
                    ? ` · ${new Date(localeMeta.researchedAt).toLocaleString()}`
                    : ''}
                  {localeMeta?.error ? ` · ${localeMeta.error}` : ''}
                </p>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || regenerating}
                  onClick={() => regenerate()}
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate AI information'}
                </button>
              </div>
              {!info ? (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => changeInfo(blankInfo())}
                >
                  Add information in {language}
                </button>
              ) : (
                <div className="space-y-3">
                  <Field label="Product name">
                    <input
                      required
                      maxLength={200}
                      className={inputClass}
                      value={info.name}
                      onChange={(e) =>
                        changeInfo({ ...info, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      rows={4}
                      maxLength={2000}
                      className={inputClass}
                      value={info.description}
                      onChange={(e) =>
                        changeInfo({ ...info, description: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      className={inputClass}
                      value={info.category ?? ''}
                      onChange={(e) =>
                        changeInfo({
                          ...info,
                          category:
                            (e.target.value as ProductInfo['category']) || null,
                        })
                      }
                    >
                      <option value="">Uncategorized</option>
                      {ASSET_CATEGORIES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                  <h3 className="text-sm font-semibold">Specifications</h3>
                  {info.specifications.map((spec, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2"
                    >
                      {(['name', 'value', 'unit'] as const).map((key) => (
                        <Field
                          key={key}
                          label={`${key === 'name' ? 'Specification' : key === 'value' ? 'Value' : 'Unit'} ${index + 1}`}
                        >
                          <input
                            className={inputClass}
                            value={spec[key] ?? ''}
                            maxLength={
                              key === 'name' ? 120 : key === 'value' ? 300 : 50
                            }
                            onChange={(e) =>
                              changeInfo({
                                ...info,
                                specifications: info.specifications.map(
                                  (item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          [key]:
                                            e.target.value ||
                                            (key === 'unit' ? null : ''),
                                        }
                                      : item,
                                ),
                              })
                            }
                          />
                        </Field>
                      ))}
                      <button
                        type="button"
                        aria-label={`Remove specification ${index + 1}`}
                        className={buttonClass}
                        onClick={() =>
                          changeInfo({
                            ...info,
                            specifications: info.specifications.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={info.specifications.length >= 40}
                    onClick={() =>
                      changeInfo({
                        ...info,
                        specifications: [
                          ...info.specifications,
                          { name: '', value: '', unit: null },
                        ],
                      })
                    }
                  >
                    Add specification
                  </button>
                  <h3 className="text-sm font-semibold">
                    Manufacturer sources
                  </h3>
                  {info.sources.map((source, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-xl border border-[var(--line)] p-3"
                    >
                      <Field label={`Source title ${index + 1}`}>
                        <input
                          required
                          maxLength={300}
                          className={inputClass}
                          value={source.title}
                          onChange={(e) =>
                            changeInfo({
                              ...info,
                              sources: info.sources.map((item, i) =>
                                i === index
                                  ? { ...item, title: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field label={`Source URL ${index + 1}`}>
                        <input
                          required
                          type="url"
                          maxLength={2048}
                          className={inputClass}
                          value={source.url}
                          onChange={(e) =>
                            changeInfo({
                              ...info,
                              sources: info.sources.map((item, i) =>
                                i === index
                                  ? { ...item, url: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Field>
                      <div className="flex gap-3">
                        {source.url.startsWith('https://') && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline"
                          >
                            Open source
                          </a>
                        )}
                        <button
                          type="button"
                          className="text-sm underline"
                          onClick={() =>
                            changeInfo({
                              ...info,
                              sources: info.sources.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          Remove source
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={info.sources.length >= 12}
                    onClick={() =>
                      changeInfo({
                        ...info,
                        sources: [...info.sources, { title: '', url: '' }],
                      })
                    }
                  >
                    Add manufacturer source
                  </button>
                </div>
              )}
              {!!localeMeta?.researchDocuments.length && (
                <details className="text-xs">
                  <summary className="cursor-pointer">
                    Original research document references
                  </summary>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--chip-bg)] p-3">
                    {JSON.stringify(localeMeta.researchDocuments, null, 2)}
                  </pre>
                </details>
              )}
            </section>
            <section className="space-y-3 border-t border-[var(--line)] pt-3">
              <h2 className="text-lg font-semibold">
                Shared documents and photos ({draft.resources.length})
              </h2>
              <Field label="Shared product photo">
                <select
                  className={inputClass}
                  value={draft.canonicalImageId ?? ''}
                  onChange={(e) =>
                    change({
                      ...draft,
                      canonicalImageId: e.target.value || null,
                    })
                  }
                >
                  <option value="">No shared photo</option>
                  {draft.resources
                    .filter(
                      (item) =>
                        item.id &&
                        item.purpose === 'photo' &&
                        item.reviewStatus === 'verified',
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="text-xs text-[var(--sea-ink-soft)]">
                Approve and save a photo source before selecting it here.
                Replacing a source URL clears its cached file; clear the
                selected photo first if replacing it. Delete removes a document
                or photo from the shared catalog when you save.
              </p>
              {draft.resources.map((resource, index) => {
                const stored = product.resources.find(
                  (item) => item.id === resource.id,
                )
                const update = (patch: Partial<typeof resource>) =>
                  change({
                    ...draft,
                    resources: draft.resources.map((item, i) =>
                      i === index ? { ...item, ...patch } : item,
                    ),
                  })
                const deleteLabel =
                  resource.purpose === 'photo'
                    ? 'Delete photo'
                    : 'Delete document'
                return (
                  <div
                    key={resource.id ?? `new-${index}`}
                    className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-3"
                  >
                    <details open={!resource.id} className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-sm font-semibold">
                        {resource.title || 'New shared resource'} ·{' '}
                        {resource.purpose} · {resource.reviewStatus}
                      </summary>
                      <div className="mt-3 space-y-3">
                        {stored?.imageUrl && (
                          <img
                            src={apiUrl(stored.imageUrl)}
                            alt={stored.title}
                            className="h-40 w-full object-contain"
                            loading="lazy"
                          />
                        )}
                        <Field label={`Resource title ${index + 1}`}>
                          <input
                            required
                            maxLength={300}
                            className={inputClass}
                            value={resource.title}
                            onChange={(e) => update({ title: e.target.value })}
                          />
                        </Field>
                        <Field label={`Resource URL ${index + 1}`}>
                          <input
                            required
                            type="url"
                            maxLength={2048}
                            className={inputClass}
                            value={resource.sourceUrl}
                            onChange={(e) =>
                              update({ sourceUrl: e.target.value })
                            }
                          />
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label={`Resource purpose ${index + 1}`}>
                            <select
                              className={inputClass}
                              value={resource.purpose}
                              onChange={(e) =>
                                update({ purpose: e.target.value })
                              }
                            >
                              <option value="manual">
                                Instructions / manual
                              </option>
                              <option value="photo">Photo</option>
                              <option value="warranty">Warranty</option>
                              <option value="other">Other</option>
                            </select>
                          </Field>
                          <Field label={`Resource review status ${index + 1}`}>
                            <select
                              className={inputClass}
                              value={resource.reviewStatus}
                              onChange={(e) =>
                                update({ reviewStatus: e.target.value })
                              }
                            >
                              <StatusOptions />
                            </select>
                          </Field>
                          <Field
                            label={`Resource languages ${index + 1} (one per line)`}
                          >
                            <textarea
                              className={inputClass}
                              value={resource.languages.join('\n')}
                              onChange={(e) =>
                                update({
                                  languages: e.target.value.split('\n'),
                                })
                              }
                            />
                          </Field>
                          <Field
                            label={`Applicable models ${index + 1} (one per line)`}
                          >
                            <textarea
                              className={inputClass}
                              value={resource.modelNumbers.join('\n')}
                              onChange={(e) =>
                                update({
                                  modelNumbers: e.target.value.split('\n'),
                                })
                              }
                            />
                          </Field>
                          <Field label={`Revision ${index + 1}`}>
                            <input
                              className={inputClass}
                              maxLength={100}
                              value={resource.revision ?? ''}
                              onChange={(e) =>
                                update({ revision: e.target.value || null })
                              }
                            />
                          </Field>
                        </div>
                        <Field label={`Relevance / notes ${index + 1}`}>
                          <textarea
                            maxLength={1000}
                            className={inputClass}
                            value={resource.reason}
                            onChange={(e) => update({ reason: e.target.value })}
                          />
                        </Field>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {resource.sourceUrl.startsWith('https://') && (
                            <a
                              href={resource.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Open public source
                            </a>
                          )}
                          {stored &&
                            stored.reviewStatus !== 'rejected' &&
                            product.reviewStatus !== 'rejected' && (
                              <a
                                href={apiUrl(stored.contentUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                Open file
                              </a>
                            )}
                        </div>
                        {stored && (
                          <p className="text-xs text-[var(--sea-ink-soft)]">
                            {stored.cached ? 'Cached file' : 'Not downloaded'} ·{' '}
                            {stored.mimeType ?? 'File type unknown'} · Updated{' '}
                            {new Date(stored.updatedAt).toLocaleString()}
                            <br />
                            Resource ID: {stored.id}
                          </p>
                        )}
                      </div>
                    </details>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
                      onClick={() => removeResource(index)}
                    >
                      {resource.id ? deleteLabel : 'Remove'}
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className={buttonClass}
                disabled={draft.resources.length >= 200}
                onClick={() =>
                  change({
                    ...draft,
                    resources: [
                      ...draft.resources,
                      {
                        title: '',
                        sourceUrl: '',
                        purpose: 'manual',
                        languages: [],
                        revision: null,
                        modelNumbers: [],
                        reason: '',
                        reviewStatus: 'candidate',
                      },
                    ],
                  })
                }
              >
                Add shared resource
              </button>
            </section>
          </fieldset>
          <details className="mt-6 text-xs text-[var(--sea-ink-soft)]">
            <summary className="cursor-pointer">Record details</summary>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all">
              <dt>Product ID</dt>
              <dd>{product.id}</dd>
              <dt>Created</dt>
              <dd>{new Date(product.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt>
              <dd>{new Date(product.updatedAt).toLocaleString()}</dd>
              <dt>Reviewed</dt>
              <dd>
                {product.reviewedAt
                  ? new Date(product.reviewedAt).toLocaleString()
                  : 'Not reviewed'}
              </dd>
              <dt>Reviewed by</dt>
              <dd>{product.reviewedBy ?? 'Not reviewed'}</dd>
            </dl>
          </details>
        </form>
      )}
    </Modal>
  )
}
