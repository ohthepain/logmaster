import { ProductCatalogMatch } from './ProductCatalogMatch'
import { fetchCatalogProduct } from '../lib/product-catalog-api'
import { AssetBrandField } from './AssetBrandField'
import { getAssetIdentity } from '../domain/asset-brands'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import {
  Camera as CameraIcon,
  LoaderCircle,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import type { AssetCategory, AssetResearch } from '../domain/asset-intelligence'
import type { AssetOwnership, BoatAsset } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'
import {
  createBoatAsset,
  fetchAssetResearchJob,
  identifyAssetPhoto,
  startAssetResearchJob,
  updateBoatAsset,
  uploadAndLinkAssetDocument,
} from '../lib/boat-assets-api'
import { useTranslation } from '../lib/i18n'
import { AssetLinkTitle, AssetLinkTypeTag } from './AssetLinkRowParts'

export type ListedBoatAsset = Pick<
  BoatAsset,
  'id' | 'name' | 'description' | 'modelNumber' | 'category'
> & { brand?: string | null }

function normalizeAssetKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/]/g, '')
}

export function findExistingBoatAsset(
  assets: ListedBoatAsset[],
  identified: {
    name: string
    brand?: string | null
    modelNumber: string | null
  },
): ListedBoatAsset | null {
  const identity = getAssetIdentity(identified)
  const candidates = assets.filter((asset) => {
    const existingBrand = getAssetIdentity(asset).brand
    return (
      !identity.brand ||
      !existingBrand ||
      normalizeAssetKey(identity.brand) === normalizeAssetKey(existingBrand)
    )
  })
  const model = identity.modelNumber
  if (model) {
    const modelKey = normalizeAssetKey(model)
    const byModel = candidates.find((asset) => {
      const existingModel = getAssetIdentity(asset).modelNumber
      return existingModel && normalizeAssetKey(existingModel) === modelKey
    })
    if (byModel) return byModel
  }
  const nameKey = normalizeAssetKey(identity.productName)
  if (!nameKey) return null
  return (
    candidates.find(
      (asset) =>
        normalizeAssetKey(getAssetIdentity(asset).productName) === nameKey,
    ) ?? null
  )
}

function mergeAssetText(existing: string | null, incoming: string) {
  const current = existing?.trim() ?? ''
  const next = incoming.trim()
  if (!current) return next || null
  if (!next || current.toLowerCase() === next.toLowerCase()) return current
  return `${current}\n\n${next}`
}

const fieldClass =
  'rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2'
const buttonClass =
  'rounded-full border border-[var(--chip-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50'

export function AddAssetModal({
  boatId,
  boatName,
  orgName,
  members,
  assets,
  onClose,
  onCreated,
  onUpdated,
  onOpenExisting,
}: {
  boatId: string
  boatName: string
  orgName: string | null
  members: ResourceMember[]
  assets: ListedBoatAsset[]
  onClose: () => void
  onCreated: (asset: BoatAsset) => void
  onUpdated: (asset: BoatAsset) => void
  onOpenExisting: (asset: ListedBoatAsset) => void
}) {
  const { t, language } = useTranslation()
  const [productId, setProductId] = useState<string | null>(null)
  const [sharedProduct, setSharedProduct] = useState(true)
  const [includeConnections, setIncludeConnections] = useState(false)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [description, setDescription] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [category, setCategory] = useState<AssetCategory | ''>('')
  const [ownership, setOwnership] = useState<AssetOwnership>('BOAT')
  const [ownedByUserId, setOwnedByUserId] = useState('')
  const [installedAt, setInstalledAt] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'camera' | 'identifying' | 'saving'
  >('idle')
  const [notice, setNotice] = useState('')
  const [research, setResearch] = useState<AssetResearch | null>(null)
  const [researchJobId, setResearchJobId] = useState<string | null>(null)
  const [researchJobActive, setResearchJobActive] = useState(false)
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [existingMatch, setExistingMatch] = useState<ListedBoatAsset | null>(
    null,
  )
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const researchPoll = useRef<AbortController | null>(null)
  const blocking =
    status === 'camera' || status === 'identifying' || status === 'saving'

  function syncExistingMatch(identity?: {
    brand?: string | null
    name?: string
    modelNumber?: string | null
  }) {
    setExistingMatch(
      findExistingBoatAsset(assets, {
        brand: identity?.brand ?? brand,
        name: identity?.name ?? name,
        modelNumber:
          identity?.modelNumber !== undefined
            ? identity.modelNumber
            : modelNumber.trim() || null,
      }),
    )
  }

  useEffect(
    () => () => {
      request.current?.abort()
      researchPoll.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!researchJobId) return
    const activeJobId: string = researchJobId
    let cancelled = false
    researchPoll.current?.abort()
    const controller = new AbortController()
    researchPoll.current = controller

    async function poll() {
      try {
        const job = await fetchAssetResearchJob(
          boatId,
          activeJobId,
          controller.signal,
        )
        if (controller.signal.aborted || cancelled) return
        if (job.status === 'completed' && job.result) {
          setResearch(job.result)
          if (job.result.productId) {
            setProductId(job.result.productId)
            void fetchCatalogProduct(
              job.result.productId,
              language,
              controller.signal,
            )
              .then((product) => {
                if (controller.signal.aborted || cancelled || !product.info)
                  return
                setName((current) => current || product.info!.name)
                setDescription(
                  (current) => current || product.info!.description,
                )
              })
              .catch(() => {})
          }
          if (job.result.category) setCategory(job.result.category)
          setResearchJobActive(false)
          if (!job.result.downloads.length && !job.result.connections.length) {
            setNotice(t('addAssetNoResearchResults'))
          }
        } else if (job.status === 'failed') {
          setResearchJobActive(false)
          setNotice(job.error ?? t('addAssetSuggestionsUnavailable'))
        } else {
          setResearchJobActive(true)
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) return
        setResearchJobActive(false)
        setNotice(
          error instanceof Error
            ? error.message
            : t('addAssetSuggestionsUnavailable'),
        )
      }
    }

    void poll()
    const interval = window.setInterval(() => void poll(), 2000)
    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(interval)
    }
  }, [boatId, researchJobId, t, language])
  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function invalidateResearch() {
    researchPoll.current?.abort()
    researchPoll.current = null
    setResearch(null)
    setResearchJobId(null)
    setResearchJobActive(false)
    setConfirmed([])
  }

  function attachPhoto(file: File) {
    if (!file.size || file.size > 15 * 1024 * 1024) {
      setNotice(t('addAssetPhotoTooLarge'))
      return
    }
    request.current?.abort()
    setPhoto(file)
    setExistingMatch(null)
    invalidateResearch()
    setNotice('')
  }

  async function autoIdentify() {
    if (!photo) return
    if (!photo.size || photo.size > 15 * 1024 * 1024) {
      setNotice(t('addAssetPhotoTooLarge'))
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setExistingMatch(null)
    invalidateResearch()
    setNotice('')
    setStatus('identifying')
    try {
      const result = await identifyAssetPhoto(boatId, photo, controller.signal)
      if (controller.signal.aborted) return
      const identity = getAssetIdentity(result)
      setProductId(null)
      setBrand(identity.brand ?? '')
      setName(identity.productName)
      setDescription(result.description)
      setModelNumber(identity.modelNumber ?? '')
      setCategory(result.category ?? '')
      syncExistingMatch({
        brand: identity.brand,
        name: result.name,
        modelNumber: result.modelNumber,
      })
      setNotice(
        result.confidence === 'low'
          ? t('addAssetIdentifyLowConfidence')
          : result.modelNumber
            ? t('addAssetIdentifyCheckModel')
            : t('addAssetIdentifyNoModelFound'),
      )
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : t('addAssetIdentifyFailedFallback'),
        )
    } finally {
      if (!controller.signal.aborted) setStatus('idle')
    }
  }

  async function openCamera() {
    if (!Capacitor.isNativePlatform()) {
      input.current?.click()
      return
    }
    setStatus('camera')
    try {
      const result = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 100,
        correctOrientation: true,
        saveToGallery: false,
      })
      if (result.webPath) {
        const response = await fetch(result.webPath)
        const blob = await response.blob()
        attachPhoto(
          new File([blob], 'asset-photo.jpg', {
            type: blob.type || 'image/jpeg',
          }),
        )
        setStatus('idle')
      } else setStatus('idle')
    } catch (error) {
      setStatus('idle')
      if (!/cancel/i.test(String(error)))
        setNotice(t('addAssetCameraUnavailable'))
    }
  }

  async function findSuggestions(model: string) {
    const identity = getAssetIdentity({ name, brand, modelNumber: model })
    setModelNumber(identity.modelNumber ?? '')
    if (!(name.trim() || description.trim() || model)) {
      setNotice(t('addAssetEnterNameForResearch'))
      return
    }
    invalidateResearch()
    setNotice('')
    try {
      const { jobId } = await startAssetResearchJob(boatId, {
        name:
          name.trim() || description.trim().slice(0, 200) || modelNumber.trim(),
        brand,
        description,
        modelNumber: identity.modelNumber,
        productId: productId ?? undefined,
        sharedProduct,
        includeConnections,
        language,
      })
      setResearchJobId(jobId)
      setResearchJobActive(true)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : t('addAssetSuggestionsUnavailable'),
      )
    }
  }

  async function applyExisting(mode: 'overwrite' | 'merge') {
    if (!existingMatch) return
    setStatus('saving')
    setNotice('')
    try {
      const incomingName =
        name.trim() || description.trim().slice(0, 200) || modelNumber.trim()
      const incomingDescription = description.trim()
      const incomingModel = modelNumber.trim() || null
      const updated = await updateBoatAsset(boatId, existingMatch.id, {
        brand:
          mode === 'overwrite'
            ? brand.trim()
            : existingMatch.brand || brand.trim(),
        name:
          mode === 'overwrite'
            ? incomingName
            : existingMatch.name.trim() || incomingName,
        description:
          mode === 'overwrite'
            ? incomingDescription || null
            : mergeAssetText(existingMatch.description, incomingDescription),
        modelNumber:
          mode === 'overwrite'
            ? incomingModel
            : existingMatch.modelNumber || incomingModel,
        category:
          mode === 'overwrite'
            ? category || null
            : existingMatch.category || category || null,
      })
      if (photo) {
        await uploadAndLinkAssetDocument(
          boatId,
          existingMatch.id,
          photo,
          'photo',
        )
      }
      onUpdated(updated)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : t('addAssetUpdateExistingFailed'),
      )
      setStatus('idle')
    }
  }

  const statusLabel =
    status === 'identifying'
      ? t('addAssetStatusIdentifying')
      : status === 'saving'
        ? existingMatch
          ? t('addAssetStatusUpdating')
          : t('addAssetStatusSaving')
        : status === 'camera'
          ? t('addAssetStatusOpeningCamera')
          : null

  return (
    <Modal
      title={t('addAsset')}
      showKicker={false}
      devComponentName="AddAssetModal"
      closeOnOutside={false}
      onClose={() => {
        if (status !== 'saving') {
          request.current?.abort()
          onClose()
        }
      }}
    >
      <form
        className="space-y-4"
        aria-busy={blocking}
        onSubmit={(event) => {
          event.preventDefault()
          if (blocking || existingMatch) return
          setStatus('saving')
          void createBoatAsset(
            boatId,
            {
              name:
                name.trim() ||
                description.trim().slice(0, 200) ||
                modelNumber.trim(),
              brand: brand.trim(),
              description: description.trim() || null,
              modelNumber: modelNumber.trim() || null,
              category: category || null,
              ownership,
              ownedByUserId:
                ownership === 'USER' ? ownedByUserId || null : null,
              installedAt: installedAt ? `${installedAt}T12:00:00.000Z` : null,
              suggestedDownloads: research?.downloads ?? [],
              confirmedConnections:
                research?.connections.filter((item) =>
                  confirmed.includes(item.assetId),
                ) ?? [],
              researchJobId: researchJobId ?? undefined,
              productId,
              sharedProduct,
              language,
            },
            photo,
          )
            .then(onCreated)
            .catch((error) => {
              setNotice(
                error instanceof Error
                  ? error.message
                  : t('addAssetSaveFailed'),
              )
              setStatus('idle')
            })
        }}
      >
        {blocking && statusLabel ? (
          <p
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm font-medium"
          >
            <LoaderCircle
              className="size-5 shrink-0 animate-spin"
              aria-hidden
            />
            {statusLabel}
          </p>
        ) : null}
        {existingMatch && status !== 'saving' ? (
          <div
            role="status"
            className="space-y-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] p-4"
          >
            <p className="m-0 font-semibold">{t('addAssetExistingOnBoat')}</p>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              {existingMatch.name}
              {existingMatch.modelNumber
                ? ` · ${existingMatch.modelNumber}`
                : ''}
              {existingMatch.category ? ` · ${existingMatch.category}` : ''}.{' '}
              {t('addAssetExistingOnBoatHelp')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[var(--btn-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-text)]"
                onClick={() => onOpenExisting(existingMatch)}
              >
                {t('open')}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void applyExisting('overwrite')}
              >
                {t('overwrite')}
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void applyExisting('merge')}
              >
                {t('merge')}
              </button>
              <button type="button" className={buttonClass} onClick={onClose}>
                {t('close')}
              </button>
            </div>
          </div>
        ) : null}
        <fieldset
          disabled={blocking}
          className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-70"
        >
          <div className="rounded-2xl border border-[var(--panel-border)] p-4">
            <button
              type="button"
              onClick={() => void openCamera()}
              className={`${buttonClass} inline-flex items-center gap-2`}
            >
              <CameraIcon className="size-5" />
              {Capacitor.isNativePlatform()
                ? t('addAssetTakePhoto')
                : t('addAssetSelectPhoto')}
            </button>
            {Capacitor.isNativePlatform() && (
              <button
                type="button"
                className={`${buttonClass} ml-2`}
                onClick={() => input.current?.click()}
              >
                {t('addAssetChoosePhoto')}
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              aria-label={t('addAssetPhotoAriaLabel')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) attachPhoto(file)
              }}
            />
            <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">
              {t('productOriginalPhotoHelp')}
            </p>
            {preview && (
              <div className="mt-3 space-y-2">
                <img
                  src={preview}
                  alt={t('addAssetPhotoAlt')}
                  className="max-h-48 w-full rounded-xl object-contain"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={status === 'identifying'}
                    className={`${buttonClass} inline-flex items-center gap-2`}
                    onClick={() => void autoIdentify()}
                  >
                    <Sparkles className="size-4" />
                    {t('addAssetAutoIdentify')}
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      setPhoto(undefined)
                      invalidateResearch()
                    }}
                  >
                    {t('addAssetRemovePhoto')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <AssetBrandField
            value={brand}
            onChange={(value) => {
              setProductId(null)
              setBrand(value)
              invalidateResearch()
              syncExistingMatch({ brand: value })
            }}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="sr-only">{t('labelModelNumber')}</span>
            <input
              className="w-full min-w-0 border-0 bg-transparent py-1 text-xl font-semibold outline-none focus:ring-1 focus:ring-[var(--chip-line)]"
              placeholder={t('labelModelNumber')}
              value={modelNumber}
              maxLength={200}
              onChange={(e) => {
                const next = e.target.value
                setProductId(null)
                setModelNumber(next)
                invalidateResearch()
                syncExistingMatch({ modelNumber: next.trim() || null })
              }}
            />
          </label>
          {brand.trim() && modelNumber.trim() && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sharedProduct}
                  onChange={(event) => {
                    setSharedProduct(event.target.checked)
                    setProductId(null)
                    invalidateResearch()
                  }}
                />
                <span>{t('productSharedConsent')}</span>
              </label>
              {sharedProduct && (
                <ProductCatalogMatch
                  brand={brand}
                  model={modelNumber}
                  language={language}
                  selectedId={productId}
                  onSelect={(product) => {
                    invalidateResearch()
                    setProductId(product.id)
                    setBrand(product.brand)
                    setModelNumber(product.modelNumber)
                    syncExistingMatch({
                      brand: product.brand,
                      modelNumber: product.modelNumber,
                      name: product.info?.name ?? name,
                    })
                    if (product.info) {
                      setName(product.info.name)
                      setDescription(product.info.description)
                      setCategory(product.info.category ?? '')
                    }
                  }}
                />
              )}
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="sr-only">{t('labelName')}</span>
            <input
              className="w-full min-w-0 border-0 bg-transparent py-1 text-lg font-semibold outline-none focus:ring-1 focus:ring-[var(--chip-line)]"
              placeholder={t('labelName')}
              value={name}
              maxLength={200}
              required={!description.trim() && !modelNumber.trim()}
              onChange={(e) => {
                const next = e.target.value
                setName(next)
                invalidateResearch()
                syncExistingMatch({ name: next })
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t('labelDescription')}</span>
            <textarea
              className={fieldClass}
              rows={2}
              maxLength={2000}
              required={!!photo && !modelNumber.trim()}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                invalidateResearch()
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t('labelCategory')}</span>
            <select
              className={fieldClass}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AssetCategory | '')
              }
            >
              <option value="">{t('uncategorized')}</option>
              {ASSET_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {modelNumber.trim() && !existingMatch && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeConnections}
                onChange={(event) =>
                  setIncludeConnections(event.target.checked)
                }
              />
              {t('productSuggestConnections')}
            </label>
          )}
          {modelNumber.trim() && !existingMatch ? (
            <button
              type="button"
              disabled={researchJobActive}
              className={`${buttonClass} inline-flex items-center gap-2`}
              onClick={() => void findSuggestions(modelNumber.trim())}
            >
              <Sparkles className="size-4" />
              {t('findDocuments')}
            </button>
          ) : null}
          {researchJobActive ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]"
            >
              <LoaderCircle
                className="size-4 shrink-0 animate-spin"
                aria-hidden
              />
              {t('addAssetResearchingBackground')}
            </p>
          ) : null}
          {research && (
            <div className="space-y-4">
              {!!research.downloads.length && (
                <div>
                  <h4 className="m-0 font-semibold">{t('assetLinks')}</h4>
                  <ul className="mt-2 list-none space-y-2 p-0">
                    {research.downloads.map((item) => (
                      <li
                        key={item.url}
                        className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"
                      >
                        <AssetLinkTypeTag url={item.url} />
                        <AssetLinkTitle url={item.url} title={item.title} />
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-[var(--chip-line)] p-2"
                          hidden={!!research.productId}
                          aria-label={t('dismissSuggestion', {
                            title: item.title,
                          })}
                          onClick={() => {
                            if (
                              !window.confirm(
                                t('removeAssetLinkConfirm', {
                                  title: item.title,
                                }),
                              )
                            ) {
                              return
                            }
                            setResearch({
                              ...research,
                              downloads: research.downloads.filter(
                                (other) => other.url !== item.url,
                              ),
                            })
                          }}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!research.connections.length && (
                <div>
                  <h4 className="m-0 font-semibold">
                    {t('possibleConnections')}
                  </h4>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    {t('possibleConnectionsHint')}
                  </p>
                  {research.connections.map((item) => (
                    <label
                      key={item.assetId}
                      className="mb-2 flex items-start gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={confirmed.includes(item.assetId)}
                        onChange={(e) =>
                          setConfirmed(
                            e.target.checked
                              ? [...confirmed, item.assetId]
                              : confirmed.filter((id) => id !== item.assetId),
                          )
                        }
                      />
                      <span>
                        <strong>
                          {assets.find((asset) => asset.id === item.assetId)
                            ?.name ?? t('existingAsset')}
                        </strong>
                        <br />
                        {item.reason}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t('labelOwnership')}</span>
            <select
              className={fieldClass}
              value={ownership}
              onChange={(e) => setOwnership(e.target.value as AssetOwnership)}
            >
              <option value="BOAT">{boatName}</option>
              <option value="ORG">{orgName ?? t('ownershipOrg')}</option>
              <option value="USER">{t('ownershipUser')}</option>
              <option value="EXTERNAL">{t('ownershipExternal')}</option>
            </select>
          </label>
          {ownership === 'USER' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{t('labelOwnedBy')}</span>
              <select
                className={fieldClass}
                value={ownedByUserId}
                onChange={(e) => setOwnedByUserId(e.target.value)}
              >
                <option value="">{t('selectMember')}</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t('labelInstalledDate')}</span>
            <input
              type="date"
              className={fieldClass}
              value={installedAt}
              onChange={(e) => setInstalledAt(e.target.value)}
            />
          </label>
        </fieldset>
        {notice && (
          <p role="status" className="text-sm text-[var(--sea-ink-soft)]">
            {notice}
          </p>
        )}
        {existingMatch ? null : (
          <button
            type="submit"
            disabled={blocking}
            className="w-full rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
          >
            {status === 'saving' ? t('saving') : t('addAsset')}
          </button>
        )}
      </form>
    </Modal>
  )
}
