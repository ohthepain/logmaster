import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Camera as CameraIcon, LoaderCircle, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import type { AssetCategory, AssetResearch } from '../domain/asset-intelligence'
import type { AssetOwnership, BoatAsset } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'
import {
  createBoatAsset,
  identifyAssetPhoto,
  researchNewAsset,
  updateBoatAsset,
  uploadAndLinkAssetDocument,
} from '../lib/boat-assets-api'

export type ListedBoatAsset = Pick<
  BoatAsset,
  'id' | 'name' | 'description' | 'modelNumber' | 'category'
>

function normalizeAssetKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s\-_/]/g, '')
}

export function findExistingBoatAsset(
  assets: ListedBoatAsset[],
  identified: { name: string; modelNumber: string | null },
): ListedBoatAsset | null {
  const model = identified.modelNumber?.trim()
  if (model) {
    const modelKey = normalizeAssetKey(model)
    const byModel = assets.find(
      (asset) =>
        asset.modelNumber && normalizeAssetKey(asset.modelNumber) === modelKey,
    )
    if (byModel) return byModel
  }
  const nameKey = normalizeAssetKey(identified.name)
  if (!nameKey) return null
  return (
    assets.find((asset) => normalizeAssetKey(asset.name) === nameKey) ?? null
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modelNumber, setModelNumber] = useState('')
  const [modelReviewed, setModelReviewed] = useState(true)
  const [category, setCategory] = useState<AssetCategory | ''>('')
  const [ownership, setOwnership] = useState<AssetOwnership>('BOAT')
  const [ownedByUserId, setOwnedByUserId] = useState('')
  const [installedAt, setInstalledAt] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'camera' | 'identifying' | 'researching' | 'saving'
  >('idle')
  const [notice, setNotice] = useState('')
  const [research, setResearch] = useState<AssetResearch | null>(null)
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [existingMatch, setExistingMatch] = useState<ListedBoatAsset | null>(
    null,
  )
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const busy = status !== 'idle'

  function rememberMatch(nextName: string, nextModel: string | null) {
    setExistingMatch(
      findExistingBoatAsset(assets, {
        name: nextName,
        modelNumber: nextModel,
      }),
    )
  }

  useEffect(() => () => request.current?.abort(), [])
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
    setResearch(null)
    setConfirmed([])
  }

  async function identify(file: File) {
    if (!file.size || file.size > 15 * 1024 * 1024) {
      setNotice('Choose a photo smaller than 15 MB.')
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPhoto(file)
    setModelNumber('')
    setModelReviewed(false)
    setExistingMatch(null)
    invalidateResearch()
    setNotice('')
    setStatus('identifying')
    try {
      const result = await identifyAssetPhoto(boatId, file, controller.signal)
      if (controller.signal.aborted) return
      setName(result.name)
      setDescription(result.description)
      setModelNumber(result.modelNumber ?? '')
      setCategory(result.category ?? '')
      rememberMatch(result.name, result.modelNumber)
      setNotice(
        result.confidence === 'low'
          ? 'The photo could not be identified confidently. Describe the asset and confirm a model number, or choose “No model number”.'
          : result.modelNumber
            ? 'Check the model number against the label before confirming.'
            : 'No model number was found. Describe the asset, or enter a model number if you know it.',
      )
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Identification failed. Enter the details manually; your photo will still be attached.',
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
        quality: 90,
        width: 2400,
        height: 2400,
        correctOrientation: true,
        saveToGallery: false,
      })
      if (result.webPath) {
        const response = await fetch(result.webPath)
        const blob = await response.blob()
        await identify(
          new File([blob], 'asset-photo.jpg', {
            type: blob.type || 'image/jpeg',
          }),
        )
      } else setStatus('idle')
    } catch (error) {
      setStatus('idle')
      if (!/cancel/i.test(String(error)))
        setNotice(
          'Camera unavailable. Check camera permissions or choose an existing photo.',
        )
    }
  }

  async function findSuggestions(model: string | null) {
    setModelNumber(model ?? '')
    setModelReviewed(true)
    invalidateResearch()
    if (!(name.trim() || description.trim())) {
      setNotice(
        'Enter a name or description, then tap Find suggestions. You can also save without suggestions.',
      )
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setStatus('researching')
    setNotice('')
    try {
      const result = await researchNewAsset(
        boatId,
        {
          name: name.trim() || description.trim().slice(0, 200),
          description,
          modelNumber: model,
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      setResearch(result)
      if (result.category) setCategory(result.category)
      if (!result.downloads.length && !result.connections.length)
        setNotice(
          'No relevant documents or likely connections were found. You can still add this asset.',
        )
    } catch (error) {
      if (!controller.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Suggestions are unavailable. You can still save the asset.',
        )
    } finally {
      if (!controller.signal.aborted) {
        rememberMatch(name, model)
        setStatus('idle')
      }
    }
  }

  async function applyExisting(mode: 'overwrite' | 'merge') {
    if (!existingMatch) return
    setStatus('saving')
    setNotice('')
    try {
      const incomingName = name.trim() || description.trim().slice(0, 200)
      const incomingDescription = description.trim()
      const incomingModel = modelNumber.trim() || null
      const updated = await updateBoatAsset(boatId, existingMatch.id, {
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
          : 'Could not update the existing asset. Please retry.',
      )
      setStatus('idle')
    }
  }

  const statusLabel =
    status === 'identifying'
      ? 'Identifying the device and reading its label…'
      : status === 'researching'
        ? 'Searching for documents and possible connections…'
        : status === 'saving'
          ? existingMatch
            ? 'Updating the existing asset…'
            : 'Saving asset and photo…'
          : status === 'camera'
            ? 'Opening camera…'
            : null

  return (
    <Modal
      title="Add asset"
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
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault()
          if (busy || existingMatch || !modelReviewed) return
          setStatus('saving')
          void createBoatAsset(
            boatId,
            {
              name: name.trim() || description.trim().slice(0, 200),
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
            },
            photo,
          )
            .then(onCreated)
            .catch((error) => {
              setNotice(
                error instanceof Error
                  ? error.message
                  : 'Could not save asset. Please retry.',
              )
              setStatus('idle')
            })
        }}
      >
        {busy && statusLabel ? (
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
        {existingMatch && !busy ? (
          <div
            role="status"
            className="space-y-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] p-4"
          >
            <p className="m-0 font-semibold">
              This equipment is already on the boat.
            </p>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              {existingMatch.name}
              {existingMatch.modelNumber
                ? ` · ${existingMatch.modelNumber}`
                : ''}
              {existingMatch.category ? ` · ${existingMatch.category}` : ''}.
              Open the existing record, overwrite it with these details, merge
              the new information, or close.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[var(--btn-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-text)]"
                onClick={() => onOpenExisting(existingMatch)}
              >
                Open
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void applyExisting('overwrite')}
              >
                Overwrite
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void applyExisting('merge')}
              >
                Merge
              </button>
              <button type="button" className={buttonClass} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
        <fieldset
          disabled={busy}
          className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-70"
        >
          <div className="rounded-2xl border border-[var(--panel-border)] p-4">
            <button
              type="button"
              onClick={() => void openCamera()}
              className={`${buttonClass} inline-flex items-center gap-2`}
            >
              <CameraIcon className="size-5" />
              {Capacitor.isNativePlatform() ? 'Take a photo' : 'Select photo'}
            </button>
            {Capacitor.isNativePlatform() && (
              <button
                type="button"
                className={`${buttonClass} ml-2`}
                onClick={() => input.current?.click()}
              >
                Choose photo
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              aria-label="Asset photo"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void identify(file)
              }}
            />
            <p className="mb-0 text-xs text-[var(--sea-ink-soft)]">
              Include the device label for the best model match. AI will review
              the photo; you confirm the details.
            </p>
            {preview && (
              <div className="mt-3 space-y-2">
                <img
                  src={preview}
                  alt="New asset"
                  className="max-h-48 w-full rounded-xl object-contain"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => photo && void identify(photo)}
                  >
                    Retry identification
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      setPhoto(undefined)
                      setModelReviewed(true)
                      invalidateResearch()
                    }}
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Name</span>
            <input
              className={fieldClass}
              value={name}
              maxLength={200}
              required={!description.trim()}
              onChange={(e) => {
                setName(e.target.value)
                setExistingMatch(null)
                invalidateResearch()
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Description</span>
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
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Model number</span>
              <input
                className={fieldClass}
                value={modelNumber}
                maxLength={200}
                onChange={(e) => {
                  setModelNumber(e.target.value)
                  setModelReviewed(false)
                  setExistingMatch(null)
                  invalidateResearch()
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!modelNumber.trim()}
                className={buttonClass}
                onClick={() => void findSuggestions(modelNumber.trim())}
              >
                Confirm model number
              </button>
              <button
                type="button"
                className={buttonClass}
                onClick={() => void findSuggestions(null)}
              >
                No model number
              </button>
            </div>
            {!modelReviewed && (
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Confirm the model number or select “No model number” before
                saving.
              </p>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Category</span>
            <select
              className={fieldClass}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AssetCategory | '')
              }
            >
              <option value="">Uncategorized</option>
              {ASSET_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          {modelReviewed && (
            <button
              type="button"
              className={`${buttonClass} inline-flex items-center gap-2`}
              onClick={() => void findSuggestions(modelNumber.trim() || null)}
            >
              <Sparkles className="size-4" />
              Find suggestions
            </button>
          )}
          {research && (
            <div className="space-y-4">
              {!!research.downloads.length && (
                <div>
                  <h4 className="m-0 font-semibold">Suggested downloads</h4>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    These will be saved with the asset. Tap Download on the
                    asset to attach a document.
                  </p>
                  <ul className="list-none space-y-2 p-0">
                    {research.downloads.map((item) => (
                      <li
                        key={item.url}
                        className="flex items-start justify-between gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"
                      >
                        <div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline"
                          >
                            {item.title}
                          </a>
                          <p className="mb-0 text-xs">{item.reason}</p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Dismiss ${item.title}`}
                          onClick={() =>
                            setResearch({
                              ...research,
                              downloads: research.downloads.filter(
                                (other) => other.url !== item.url,
                              ),
                            })
                          }
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
                  <h4 className="m-0 font-semibold">Possible connections</h4>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    Select only connections you can confirm on your boat.
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
                            ?.name ?? 'Existing asset'}
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
            <span className="font-semibold">Ownership</span>
            <select
              className={fieldClass}
              value={ownership}
              onChange={(e) => setOwnership(e.target.value as AssetOwnership)}
            >
              <option value="BOAT">{boatName}</option>
              <option value="ORG">{orgName ?? 'Org'}</option>
              <option value="USER">User</option>
              <option value="EXTERNAL">External</option>
            </select>
          </label>
          {ownership === 'USER' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Owned by</span>
              <select
                className={fieldClass}
                value={ownedByUserId}
                onChange={(e) => setOwnedByUserId(e.target.value)}
              >
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Installed date</span>
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
            disabled={busy || !modelReviewed}
            className="w-full rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving…' : 'Add asset'}
          </button>
        )}
      </form>
    </Modal>
  )
}
