import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import {
  ArrowLeft,
  ArrowRight,
  Camera as CameraIcon,
  FileText,
  Hash,
  ImageIcon,
  Link2,
  LoaderCircle,
  Network,
  Plus,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EquipmentFlowDialog } from './EquipmentFlowDialog'
import { EquipmentIdentityFields } from './EquipmentIdentityFields'
import { AssetBrandLogo } from './AssetBrandLogo'
import { BoatDocumentViewerModal } from './BoatDocumentViewerModal'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import { getAssetIdentity } from '../domain/asset-brands'
import {
  equipmentDocuments,
  hasLocalizedDocuments,
  languageRank,
  productModelKey,
} from '../domain/product-catalog'
import type { EquipmentModelOption } from '../domain/equipment-model-option'
import { ProductCatalogMatch } from './ProductCatalogMatch'
import { ProductNetworkPorts } from './ProductNetworkPorts'
import {
  fetchCatalogProduct,
  fetchEquipmentModelOptions,
  findCatalogProducts,
  resolveEquipmentProduct,
} from '../lib/product-catalog-api'
import {
  createBoatAsset,
  fetchAssetResearchJob,
  findEquipmentConnections,
  identifyAssetPhoto,
  identifyEquipmentLink,
  startAssetResearchJob,
  updateBoatAsset,
  uploadAndLinkAssetDocument,
  fetchConnectionPeers,
} from '../lib/boat-assets-api'
import type { ConnectionPeerOption } from '../lib/boat-assets-api'
import { apiUrl } from '../lib/app-origin'
import { useTranslation } from '../lib/i18n'
import { openBoatDocument } from '../lib/boat-document-open'
import type { BoatDocumentViewerPayload } from '../lib/boat-document-open'
import type {
  AssetCategory,
  AssetConnectionSuggestion,
  AssetIdentification,
  AssetResearch,
} from '../domain/asset-intelligence'
import type { CatalogProduct } from '../domain/product-catalog'
import type { AssetOwnership, BoatAsset } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'

export type ListedBoatAsset = Pick<
  BoatAsset,
  'id' | 'name' | 'description' | 'modelNumber' | 'category'
> & {
  brand?: string | null
}
const normalized = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/]/g, '')
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
    const brand = getAssetIdentity(asset).brand
    return (
      !identity.brand ||
      !brand ||
      normalized(identity.brand) === normalized(brand)
    )
  })
  if (identity.modelNumber) {
    const match = candidates.find((asset) => {
      const model = getAssetIdentity(asset).modelNumber
      return model && normalized(model) === normalized(identity.modelNumber!)
    })
    if (match) return match
  }
  return identity.productName
    ? (candidates.find(
        (asset) =>
          normalized(getAssetIdentity(asset).productName) ===
          normalized(identity.productName),
      ) ?? null)
    : null
}
type Step =
  | 'find'
  | 'results'
  | 'documentPrompt'
  | 'documentProgress'
  | 'documents'
  | 'connectionPrompt'
  | 'connections'
  | 'addConnection'
type FindMode = 'photo' | 'model' | 'link'
const field =
  'min-h-12 w-full min-w-0 rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-3 text-base outline-none focus:border-[var(--sea-ink)]'
const secondary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--chip-line)] px-5 py-3 text-sm font-semibold disabled:opacity-40'
const primary =
  'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-[var(--btn-text)] transition-opacity hover:opacity-85 disabled:opacity-40'

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
  const [step, setStep] = useState<Step>('find')
  const [findMode, setFindMode] = useState<FindMode>('photo')
  const [productLink, setProductLink] = useState('')
  const [linkPhotoUrl, setLinkPhotoUrl] = useState<string | null>(null)
  const [brand, setBrand] = useState(''),
    [model, setModel] = useState('')
  const [noModel, setNoModel] = useState(false)
  const [name, setName] = useState(''),
    [description, setDescription] = useState('')
  const [category, setCategory] = useState<AssetCategory | ''>('')
  const [ownership, setOwnership] = useState<AssetOwnership>('BOAT')
  const [ownedByUserId, setOwnedByUserId] = useState(''),
    [installedAt, setInstalledAt] = useState('')
  const [photo, setPhoto] = useState<File>(),
    [preview, setPreview] = useState('')
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [busy, setBusy] = useState<
    'camera' | 'identify' | 'lookup' | 'connections' | 'save' | null
  >(null)
  const [notice, setNotice] = useState(''),
    [lookupFailed, setLookupFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [research, setResearch] = useState<AssetResearch | null>(null)
  const [researchActive, setResearchActive] = useState(false),
    [researchStarting, setResearchStarting] = useState(false)
  const [researchError, setResearchError] = useState('')
  const [connections, setConnections] = useState<AssetConnectionSuggestion[]>(
      [],
    ),
    [selected, setSelected] = useState<string[]>([])
  const [connectionPeers, setConnectionPeers] =
    useState<ConnectionPeerOption | null>(null)
  const [manualId, setManualId] = useState(''),
    [anotherUnit, setAnotherUnit] = useState(false)
  const [modelPickRequired, setModelPickRequired] = useState(false)
  const [catalogMatches, setCatalogMatches] = useState<CatalogProduct[]>([])
  const [suggestedModels, setSuggestedModels] = useState<
    EquipmentModelOption[]
  >([])
  const [brandGuesses, setBrandGuesses] = useState<string[]>([])
  const [brandCorrect, setBrandCorrect] = useState(true)
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null)
  const [viewer, setViewer] = useState<BoatDocumentViewerPayload | null>(null)
  const input = useRef<HTMLInputElement>(null),
    request = useRef<AbortController | null>(null)
  const generation = useRef(0),
    mounted = useRef(true),
    saving = useRef(false),
    researchStart = useRef(false)
  const stage =
    step === 'find' || step === 'results'
      ? 0
      : step.startsWith('document')
        ? 1
        : 2
  const existing = anotherUnit
    ? null
    : findExistingBoatAsset(assets, {
        name,
        brand,
        modelNumber: noModel ? null : model,
      })
  const connectionCandidates = assets
  const networkCandidates = connectionPeers?.networks ?? []
  function connectionName(
    connection: Pick<AssetConnectionSuggestion, 'assetId' | 'name'>,
  ) {
    return (
      connection.name ||
      assets.find((asset) => asset.id === connection.assetId)?.name ||
      networkCandidates.find((network) => network.id === connection.assetId)
        ?.name ||
      connection.assetId
    )
  }
  const documents = equipmentDocuments(product, language)
  const privateDocuments = product
    ? []
    : (research?.downloads.filter((item) => item.purpose !== 'photo') ?? [])
  const sharedImage = product?.imageUrl || product?.previewImageUrl
  const image = !imageFailed && sharedImage ? apiUrl(sharedImage) : preview

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!photo) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  useEffect(() => {
    if (
      step !== 'connectionPrompt' &&
      step !== 'connections' &&
      step !== 'addConnection'
    )
      return
    if (connectionPeers) return
    const controller = new AbortController()
    void fetchConnectionPeers(boatId)
      .then((peers) => {
        if (!controller.signal.aborted && mounted.current)
          setConnectionPeers(peers)
      })
      .catch(() => {
        if (!controller.signal.aborted && mounted.current)
          setConnectionPeers({ equipment: [], networks: [] })
      })
    return () => controller.abort()
  }, [step, boatId, connectionPeers])
  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const job = await fetchAssetResearchJob(
          boatId,
          jobId!,
          controller.signal,
        )
        if (controller.signal.aborted) return
        if (job.status === 'completed' && job.result) {
          setResearch(job.result)
          if (job.result.productId) {
            const updated = await fetchCatalogProduct(
              job.result.productId,
              language,
              controller.signal,
            )
            if (controller.signal.aborted) return
            setProduct(updated)
          }
          setResearchActive(false)
          setResearchError('')
          setStep((current) =>
            current === 'documentProgress' ? 'documents' : current,
          )
          return
        }
        if (job.status === 'failed') {
          setResearchActive(false)
          setResearchError(job.error || t('addAssetSuggestionsUnavailable'))
          return
        }
        setResearchError('')
        timer = setTimeout(() => void poll(), 2000)
      } catch (error) {
        if (controller.signal.aborted) return
        setResearchError(
          error instanceof Error
            ? error.message
            : t('addAssetSuggestionsUnavailable'),
        )
        timer = setTimeout(() => void poll(), 5000)
      }
    }
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [boatId, jobId, language, t])

  function invalidate() {
    generation.current += 1
    request.current?.abort()
    setProduct(null)
    setJobId(null)
    setResearch(null)
    setResearchActive(false)
    setResearchError('')
    setConnections([])
    setSelected([])
    setAnotherUnit(false)
    setModelPickRequired(false)
    setCatalogMatches([])
    setSuggestedModels([])
    setBrandGuesses([])
    setBrandCorrect(true)
    setSelectedModelKey(null)
    setLookupFailed(false)
    setImageFailed(false)
    setLinkPhotoUrl(null)
    setNotice('')
  }
  function close() {
    if (saving.current) return
    if (
      !(brand || model || description || photo || productLink.trim()) ||
      window.confirm(t('equipmentCloseConfirm'))
    ) {
      onClose()
    }
  }
  function isValidProductLink(value: string) {
    try {
      const parsed = new URL(value.trim())
      return (
        parsed.protocol === 'https:' && !parsed.username && !parsed.password
      )
    } catch {
      return false
    }
  }
  function findModeHelp(mode: FindMode) {
    switch (mode) {
      case 'photo':
        return t('equipmentFindHelpPhoto')
      case 'model':
        return t('equipmentFindHelpModel')
      case 'link':
        return t('equipmentFindHelpLink')
    }
  }
  function backToFind() {
    request.current?.abort()
    setBusy(null)
    setNotice('')
    setStep('find')
  }
  function identityInput() {
    return {
      name: name.trim() || model.trim() || description.trim().slice(0, 200),
      brand: brand.trim() || null,
      modelNumber: noModel ? null : model.trim() || null,
      description,
      category: category || null,
      productId: product?.id,
    }
  }
  function canSearch() {
    if (findMode === 'photo') return !!photo
    if (findMode === 'link') return isValidProductLink(productLink)
    return !noModel
      ? brand.trim().length > 0 && model.trim().length > 0
      : description.trim().length > 0
  }
  function applyIdentification(result: AssetIdentification) {
    const identity = getAssetIdentity(result)
    const hasModel = !!identity.modelNumber
    setBrand(identity.brand ?? '')
    setModel(identity.modelNumber ?? '')
    setName(identity.productName)
    setDescription(result.description)
    setCategory(result.category ?? '')
    setNoModel(!hasModel)
    setLinkPhotoUrl(result.photoUrl ?? null)
    setNotice(
      t(
        result.confidence === 'low'
          ? 'addAssetIdentifyLowConfidence'
          : result.modelNumber
            ? 'addAssetIdentifyCheckModel'
            : 'addAssetIdentifyNoModelFound',
      ),
    )
    return {
      brand: identity.brand ?? '',
      model: identity.modelNumber ?? '',
      hasModel,
    }
  }
  function selectPhoto(file: File) {
    if (!file.size || file.size > 15 * 1024 * 1024) {
      setNotice(t('addAssetPhotoTooLarge'))
      return
    }
    setPhoto(file)
    setNotice('')
  }
  async function identifyFromPhoto() {
    if (!photo) return null
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setBusy('identify')
    setNotice('')
    try {
      const result = await identifyAssetPhoto(boatId, photo, controller.signal)
      if (controller.signal.aborted || !mounted.current) return null
      return applyIdentification(result)
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        setNotice(
          error instanceof Error
            ? error.message
            : t('addAssetIdentifyFailedFallback'),
        )
      return null
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(null)
    }
  }
  async function identifyFromLink() {
    const url = productLink.trim()
    if (!isValidProductLink(url)) return null
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setBusy('identify')
    setNotice('')
    try {
      const result = await identifyEquipmentLink(boatId, url, controller.signal)
      if (controller.signal.aborted || !mounted.current) return null
      return applyIdentification(result)
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        setNotice(
          error instanceof Error
            ? error.message
            : t('addAssetIdentifyFailedFallback'),
        )
      return null
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(null)
    }
  }
  async function openCamera() {
    if (!Capacitor.isNativePlatform()) {
      input.current?.click()
      return
    }
    setBusy('camera')
    try {
      const result = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.Uri,
        quality: 100,
        correctOrientation: true,
        saveToGallery: false,
      })
      if (!mounted.current) return
      if (result.webPath) {
        const blob = await (await fetch(result.webPath)).blob()
        if (!mounted.current) return
        selectPhoto(
          new File([blob], `equipment-photo.${result.format || 'jpg'}`, {
            type: blob.type || 'image/jpeg',
          }),
        )
        setBusy(null)
      } else setBusy(null)
    } catch (error) {
      if (mounted.current) {
        setBusy(null)
        if (!/cancel/i.test(String(error)))
          setNotice(t('addAssetCameraUnavailable'))
      }
    }
  }
  function goToResults() {
    setStep('results')
    setNotice('')
    setImageFailed(false)
  }
  async function lookupCatalogProduct(catalog?: {
    brand: string
    model: string
    productId?: string
    photoUrl?: string | null
    sourceUrl?: string | null
  }) {
    const brandValue = (catalog?.brand ?? brand).trim()
    const modelValue = (catalog?.model ?? model).trim()
    if (!brandValue || !modelValue) return
    if (noModel && !catalog) return
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setBusy('lookup')
    setLookupFailed(false)
    setImageFailed(false)
    setModelPickRequired(false)
    try {
      const linkHints =
        findMode === 'link' && isValidProductLink(productLink)
          ? {
              sourceUrl: productLink.trim(),
              photoUrl: linkPhotoUrl,
            }
          : undefined
      const hints = {
        ...linkHints,
        ...(catalog?.sourceUrl ? { sourceUrl: catalog.sourceUrl } : {}),
        ...(catalog?.photoUrl ? { photoUrl: catalog.photoUrl } : {}),
        productId: catalog?.productId,
      }
      let result = await resolveEquipmentProduct(
        brandValue,
        modelValue,
        language,
        controller.signal,
        hints,
      )
      while (result.pending && !controller.signal.aborted) {
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer)
            controller.signal.removeEventListener('abort', done)
            resolve()
          }
          const timer = setTimeout(done, 2500)
          controller.signal.addEventListener('abort', done, { once: true })
        })
        if (controller.signal.aborted) return
        result = await resolveEquipmentProduct(
          brandValue,
          modelValue,
          language,
          controller.signal,
          hints,
        )
      }
      if (controller.signal.aborted || !mounted.current) return
      setProduct(result.product)
      setBrand(result.product.brand)
      setModel(result.product.modelNumber)
      setSelectedModelKey(productModelKey(result.product.modelNumber))
      setNotice(result.notice)
      if (result.product.info) {
        setName(result.product.info.name)
        setDescription((current) => current || result.product.info!.description)
        setCategory((current) => current || result.product.info!.category || '')
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setLookupFailed(true)
        setNotice(
          error instanceof Error
            ? error.message
            : t('productLookupUnavailable'),
        )
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(null)
    }
  }
  async function selectCatalogProduct(match: CatalogProduct) {
    setSelectedModelKey(productModelKey(match.modelNumber))
    setBrand(match.brand)
    setModel(match.modelNumber)
    if (match.info) {
      setName(match.info.name)
      setDescription((current) => current || match.info!.description)
      setCategory((current) => current || match.info!.category || '')
    }
    await lookupCatalogProduct({
      brand: match.brand,
      model: match.modelNumber,
      productId: match.id,
      sourceUrl: match.info?.sources?.[0]?.url ?? null,
    })
  }
  async function selectSuggestedModel(option: EquipmentModelOption) {
    const nextBrand = option.brand.trim() || brand.trim()
    setSelectedModelKey(productModelKey(option.modelNumber))
    setBrand(nextBrand)
    setModel(option.modelNumber)
    setName(option.name)
    setDescription((current) => current || option.description)
    await lookupCatalogProduct({
      brand: nextBrand,
      model: option.modelNumber,
      photoUrl: option.imageUrl,
      sourceUrl: option.productPageUrl,
    })
  }
  function showModelPicker(
    catalog: CatalogProduct[],
    suggested: EquipmentModelOption[],
    guesses: string[] = [],
    nextBrandCorrect = true,
  ) {
    setCatalogMatches(catalog)
    setSuggestedModels(suggested)
    setBrandGuesses(guesses)
    setBrandCorrect(nextBrandCorrect)
    setModelPickRequired(true)
    setNotice('')
  }
  async function searchCatalogByModel(typedBrand: string, typedModel: string) {
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setBusy('lookup')
    setLookupFailed(false)
    setCatalogMatches([])
    setSuggestedModels([])
    setBrandGuesses([])
    setBrandCorrect(true)
    setModelPickRequired(false)
    setProduct(null)
    try {
      const match = await findCatalogProducts(
        typedBrand,
        typedModel,
        language,
        controller.signal,
      )
      if (controller.signal.aborted || !mounted.current) return
      if (match.exact && match.products.length === 1) {
        await selectCatalogProduct(match.products[0])
        return
      }
      if (match.products.length > 1 || match.ambiguous) {
        showModelPicker(match.products, [])
        return
      }
      const suggested = await fetchEquipmentModelOptions(
        typedBrand,
        typedModel,
        controller.signal,
      )
      if (controller.signal.aborted || !mounted.current) return
      const catalog = suggested.products ?? []
      if (
        suggested.brandCorrect &&
        catalog.length === 1 &&
        !suggested.ambiguous
      ) {
        await selectCatalogProduct(catalog[0])
        return
      }
      if (catalog.length || suggested.brandGuesses.length) {
        showModelPicker(
          catalog,
          [],
          suggested.brandGuesses,
          suggested.brandCorrect,
        )
        return
      }
      if (
        suggested.brandCorrect &&
        suggested.options.length === 1 &&
        !suggested.ambiguous
      ) {
        await selectSuggestedModel(suggested.options[0])
        return
      }
      if (suggested.options.length || suggested.brandGuesses.length) {
        showModelPicker(
          [],
          suggested.options,
          suggested.brandGuesses,
          suggested.brandCorrect,
        )
        return
      }
      setLookupFailed(true)
      setNotice(t('productLookupUnavailable'))
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setLookupFailed(true)
        setNotice(
          error instanceof Error
            ? error.message
            : t('productLookupUnavailable'),
        )
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(null)
    }
  }
  async function runSearch() {
    if (!canSearch() || busy) return
    invalidate()
    const typedBrand = brand.trim()
    const typedModel = model.trim()
    if (findMode === 'model' && !noModel && typedBrand && typedModel) {
      goToResults()
      await searchCatalogByModel(typedBrand, typedModel)
      return
    }
    if (findMode === 'model' && noModel) {
      goToResults()
      return
    }
    const identified =
      findMode === 'link' ? await identifyFromLink() : await identifyFromPhoto()
    if (!mounted.current || !identified) return
    if (identified.hasModel && identified.brand && identified.model) {
      goToResults()
      await searchCatalogByModel(identified.brand, identified.model)
      return
    }
    goToResults()
  }
  function continueWithoutSearch() {
    goToResults()
  }
  function startDocumentsStep() {
    setNotice('')
    setStep(
      researchActive
        ? 'documentProgress'
        : hasLocalizedDocuments(product, language)
          ? 'documents'
          : 'documentPrompt',
    )
  }
  async function startDocuments() {
    if (researchStart.current || researchActive) return
    researchStart.current = true
    setResearchStarting(true)
    setResearchError('')
    const version = generation.current
    try {
      const result = await startAssetResearchJob(boatId, {
        ...identityInput(),
        productId: product?.id,
        sharedProduct: true,
        includeConnections: false,
        language,
      })
      if (!mounted.current || version !== generation.current) return
      setJobId(result.jobId)
      setResearchActive(true)
      setStep('documentProgress')
    } catch (error) {
      if (mounted.current && version === generation.current)
        setResearchError(
          error instanceof Error
            ? error.message
            : t('addAssetSuggestionsUnavailable'),
        )
    } finally {
      researchStart.current = false
      if (mounted.current) setResearchStarting(false)
    }
  }
  async function searchConnections() {
    setNotice('')
    setStep('connections')
    setBusy('connections')
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    try {
      const [result, peers] = await Promise.all([
        findEquipmentConnections(boatId, identityInput(), controller.signal),
        fetchConnectionPeers(boatId).catch(
          (): ConnectionPeerOption => ({ equipment: [], networks: [] }),
        ),
      ])
      if (!controller.signal.aborted && mounted.current) {
        setConnectionPeers(peers)
        const allowedIds = new Set([
          ...connectionCandidates.map((asset) => asset.id),
          ...peers.equipment.map((asset) => asset.id),
          ...peers.networks.map((network) => network.id),
        ])
        const allowed = result.filter(
          (item) => allowedIds.has(item.assetId) || item.kind === 'network',
        )
        setConnections(allowed)
        setSelected(allowed.map((item) => item.assetId))
      }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        setNotice(
          error instanceof Error
            ? error.message
            : t('addAssetSuggestionsUnavailable'),
        )
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(null)
    }
  }
  async function save() {
    if (saving.current) return
    saving.current = true
    setBusy('save')
    setNotice('')
    try {
      const asset = await createBoatAsset(
        boatId,
        {
          ...identityInput(),
          productId: product?.id,
          sharedProduct: true,
          researchDocuments: false,
          language,
          ownership,
          ownedByUserId: ownedByUserId || null,
          installedAt: installedAt
            ? new Date(`${installedAt}T12:00:00`).toISOString()
            : null,
          researchJobId: jobId ?? undefined,
          suggestedDownloads: product ? [] : (research?.downloads ?? []),
          confirmedConnections: connections.filter((item) =>
            selected.includes(item.assetId),
          ),
        },
        photo,
      )
      onCreated(asset)
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : t('addAssetSaveFailed'),
      )
      saving.current = false
      setBusy(null)
    }
  }
  async function mergeExisting() {
    if (!existing || saving.current) return
    saving.current = true
    setBusy('save')
    try {
      const current = existing.description?.trim() ?? '',
        incoming = description.trim()
      const updated = await updateBoatAsset(boatId, existing.id, {
        name: existing.name || name || model,
        brand: existing.brand || brand,
        modelNumber: existing.modelNumber || model || null,
        category: existing.category || category || null,
        description:
          current &&
          incoming &&
          current.toLowerCase() !== incoming.toLowerCase()
            ? `${current}\n\n${incoming}`
            : current || incoming || null,
      })
      if (photo)
        await uploadAndLinkAssetDocument(boatId, existing.id, photo, 'photo')
      onUpdated(updated)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : t('addAssetUpdateExistingFailed'),
      )
      saving.current = false
      setBusy(null)
    }
  }
  const action = (
    label: string,
    onClick: () => void,
    disabled = false,
    next = false,
  ) => (
    <button
      type="button"
      className={primary}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {next && <ArrowRight className="size-4" />}
    </button>
  )
  const back = (onClick: () => void) => (
    <button
      type="button"
      className={secondary}
      onClick={onClick}
      disabled={busy === 'save'}
    >
      <ArrowLeft className="size-4" />
      {t('equipmentBack')}
    </button>
  )
  let footer
  if (step === 'find')
    footer = (
      <>
        {findMode === 'model' &&
          noModel &&
          action(
            t('equipmentNext'),
            continueWithoutSearch,
            !!busy || !description.trim(),
            true,
          )}
        {action(
          t('equipmentSearch'),
          () => void runSearch(),
          !!busy || !canSearch(),
        )}
      </>
    )
  else if (step === 'results')
    footer = (
      <>
        {back(backToFind)}
        {action(
          t('equipmentNext'),
          startDocumentsStep,
          !!busy ||
            !!existing ||
            lookupFailed ||
            modelPickRequired ||
            (!noModel && findMode === 'model' && !model.trim()),
          true,
        )}
      </>
    )
  else if (step === 'documentPrompt')
    footer = (
      <>
        <button
          type="button"
          className={secondary}
          onClick={() => setStep('documents')}
          disabled={researchStarting}
        >
          {t('equipmentSkip')}
        </button>
        {action(
          researchStarting ? t('loading') : t('equipmentOkay'),
          () => void startDocuments(),
          researchStarting,
        )}
      </>
    )
  else if (step === 'documentProgress')
    footer = (
      <>
        {back(() => setStep('results'))}
        {action(t('equipmentSkip'), () => setStep('documents'))}
      </>
    )
  else if (step === 'documents')
    footer = (
      <>
        {back(() => setStep('results'))}
        {action(
          t('equipmentNext'),
          () => {
            setNotice('')
            setStep('connectionPrompt')
          },
          false,
          true,
        )}
      </>
    )
  else if (step === 'connectionPrompt')
    footer = (
      <>
        <button
          type="button"
          className={secondary}
          onClick={() => setStep('connections')}
        >
          {t('equipmentSkip')}
        </button>
        {action(t('equipmentOkay'), () => void searchConnections())}
      </>
    )
  else if (step === 'connections')
    footer = (
      <>
        {back(() => {
          request.current?.abort()
          setBusy(null)
          setStep('connectionPrompt')
        })}
        {action(
          busy === 'save' ? t('saving') : t('equipmentFinish'),
          () => void save(),
          !!busy || selected.length > 20,
        )}
      </>
    )
  else
    footer = (
      <>
        {back(() => setStep('connections'))}
        {action(
          t('equipmentAddConnection'),
          () => {
            if (!manualId) return
            const network = networkCandidates.find(
              (item) => item.id === manualId,
            )
            if (!connections.some((item) => item.assetId === manualId))
              setConnections([
                ...connections,
                {
                  assetId: manualId,
                  reason: t('equipmentManualConnection'),
                  name: network?.name,
                  kind: network ? 'network' : 'equipment',
                  connectionType: 'cable',
                },
              ])
            setSelected([...new Set([...selected, manualId])])
            setManualId('')
            setStep('connections')
          },
          !manualId || selected.length >= 20,
        )}
      </>
    )
  function intro(title: string, help: string) {
    return (
      <div className="mb-6">
        <h3 className="m-0 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mb-0 mt-2 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
          {help}
        </p>
      </div>
    )
  }
  function loading(title: string, help?: string) {
    return (
      <div
        role="status"
        className="flex min-h-64 flex-col items-center justify-center gap-5 py-10 text-center"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-[var(--chip-bg)]">
          <LoaderCircle className="size-8 animate-spin motion-reduce:animate-none" />
        </div>
        <div>
          <h3 className="m-0 text-xl font-semibold">{title}</h3>
          {help && (
            <p className="mb-0 mt-3 max-w-sm text-sm leading-relaxed text-[var(--sea-ink-soft)]">
              {help}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <EquipmentFlowDialog
      title={
        step === 'addConnection'
          ? t('equipmentAddConnection')
          : t('equipmentTitle')
      }
      stage={stage}
      stages={[
        t('equipmentStage'),
        t('equipmentDocuments'),
        t('equipmentConnections'),
      ]}
      stepKey={step}
      closeLabel={t('close')}
      suspended={!!viewer}
      onClose={close}
      footer={<div className="flex items-center gap-3">{footer}</div>}
    >
      {step === 'find' && (
        <>
          <div
            className="mb-5 flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] p-1"
            role="tablist"
            aria-label={t('equipmentFindModel')}
          >
            {(
              [
                {
                  id: 'photo' as const,
                  label: t('equipmentFindModePhoto'),
                  icon: CameraIcon,
                },
                {
                  id: 'model' as const,
                  label: t('equipmentFindModeModel'),
                  icon: Hash,
                },
                {
                  id: 'link' as const,
                  label: t('equipmentFindModeLink'),
                  icon: Link2,
                },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={findMode === mode.id}
                disabled={!!busy}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  findMode === mode.id
                    ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                    : 'text-[var(--sea-ink-soft)]'
                }`}
                onClick={() => {
                  if (findMode === mode.id) return
                  invalidate()
                  setFindMode(mode.id)
                  setNotice('')
                }}
              >
                <mode.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{mode.label}</span>
              </button>
            ))}
          </div>
          {intro(t('equipmentFindModel'), findModeHelp(findMode))}
          {findMode === 'photo' && (
            <div className="relative mb-2 flex min-h-36 flex-col items-center justify-center py-4">
              <button
                type="button"
                onClick={() => void openCamera()}
                disabled={!!busy}
                aria-label={t('equipmentCamera')}
                className="group relative flex size-24 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--chip-line)] bg-[var(--chip-bg)] shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt={t('addAssetPhotoAlt')}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <CameraIcon className="size-9 stroke-[1.5]" />
                )}
                {preview && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-[var(--surface-strong)] p-1.5">
                    <CameraIcon className="size-4" />
                  </span>
                )}
              </button>
              <p className="mb-0 mt-3 text-xs text-[var(--sea-ink-soft)]">
                {t('equipmentCameraHint')}
              </p>
              <input
                ref={input}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label={t('addAssetPhotoAriaLabel')}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) selectPhoto(file)
                }}
              />
            </div>
          )}
          {busy === 'identify' ? (
            loading(t('addAssetStatusIdentifying'))
          ) : busy === 'camera' ? (
            loading(t('loading'))
          ) : findMode === 'model' ? (
            <>
              <EquipmentIdentityFields
                brand={brand}
                model={model}
                language={language}
                noModel={noModel}
                onBrand={(value) => {
                  if (value !== brand) {
                    invalidate()
                    setBrand(value)
                    setModel('')
                    setName('')
                    setCategory('')
                  }
                }}
                onModel={(value) => {
                  if (value !== model) {
                    invalidate()
                    setModel(value)
                    setName('')
                    setCategory('')
                  }
                }}
              />
              <label className="my-5 flex min-h-11 items-center gap-3 text-sm text-[var(--sea-ink-soft)]">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--sea-ink)]"
                  checked={noModel}
                  onChange={(event) => {
                    invalidate()
                    setNoModel(event.target.checked)
                    setModel('')
                  }}
                />
                {t('equipmentNoModel')}
              </label>
              {noModel && (
                <label className="block space-y-2 text-sm font-semibold">
                  {t('labelDescription')}
                  <textarea
                    className={field}
                    rows={3}
                    maxLength={2000}
                    placeholder={t('equipmentDescriptionHint')}
                    value={description}
                    onChange={(event) => {
                      invalidate()
                      setDescription(event.target.value)
                    }}
                  />
                </label>
              )}
            </>
          ) : findMode === 'link' ? (
            <label className="block space-y-2 text-sm font-semibold">
              {t('equipmentLinkLabel')}
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                className={field}
                placeholder={t('equipmentLinkPlaceholder')}
                value={productLink}
                onChange={(event) => {
                  invalidate()
                  setProductLink(event.target.value)
                }}
              />
            </label>
          ) : null}
        </>
      )}
      {step === 'results' &&
        (busy === 'lookup' ? (
          loading(t('equipmentLooking'), t('equipmentLookingHelp'))
        ) : modelPickRequired && !product ? (
          <>
            {!brandCorrect && brandGuesses.length > 0 ? (
              <div className="mb-5 space-y-3">
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  {t('equipmentBrandMismatch', { brand })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {brandGuesses.map((guess) => (
                    <button
                      key={guess}
                      type="button"
                      className={secondary}
                      disabled={!!busy}
                      onClick={() => {
                        setBrand(guess)
                        void searchCatalogByModel(guess, model.trim())
                      }}
                    >
                      {guess}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mb-5 space-y-4">
              <EquipmentIdentityFields
                brand={brand}
                model={model}
                language={language}
                noModel={false}
                onBrand={(value) => {
                  if (value !== brand) setBrand(value)
                }}
                onModel={(value) => {
                  if (value !== model) setModel(value)
                }}
              />
              <button
                type="button"
                className={secondary}
                disabled={!!busy || !brand.trim() || !model.trim()}
                onClick={() =>
                  void searchCatalogByModel(brand.trim(), model.trim())
                }
              >
                {t('equipmentSearchAgain')}
              </button>
            </div>
            <ProductCatalogMatch
              brand={brand}
              model={model}
              language={language}
              selectedModelKey={selectedModelKey}
              catalogProducts={catalogMatches}
              suggestedOptions={suggestedModels}
              onSelectCatalog={(match) => void selectCatalogProduct(match)}
              onSelectSuggested={(option) => void selectSuggestedModel(option)}
            />
            {!catalogMatches.length &&
              !suggestedModels.length &&
              !brandGuesses.length && (
                <p className="text-sm text-[var(--sea-ink-soft)]">
                  {t('equipmentPickModelRequired')}
                </p>
              )}
          </>
        ) : (
          <>
            {intro(t('equipmentResults'), t('equipmentResultsHelp'))}
            <ProductNetworkPorts
              connections={product?.networkConnections ?? []}
              label={t('equipmentProductNetworks')}
            />
            {product?.info?.specifications?.length ? (
              <ul className="mb-4 list-none space-y-1 rounded-2xl bg-[var(--chip-bg)] p-4 text-sm text-[var(--sea-ink-soft)]">
                {product.info.specifications.slice(0, 6).map((spec) => (
                  <li key={`${spec.name}-${spec.value}`}>
                    <span className="font-semibold text-[var(--sea-ink)]">
                      {spec.name}:
                    </span>{' '}
                    {spec.value}
                    {spec.unit ? ` ${spec.unit}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mb-6 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-3xl">
              {image ? (
                <img
                  src={image}
                  alt={[brand, model, name].filter(Boolean).join(' ')}
                  onError={() => setImageFailed(true)}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-500">
                  <ImageIcon className="size-10 stroke-1" />
                  {t('equipmentNoPhoto')}
                </div>
              )}
            </div>
            <AssetBrandLogo brand={brand} prominent />
            <h3 className="mb-1 mt-3 break-words text-3xl font-bold tracking-tight">
              {model || name || description}
            </h3>
            {name && model && (
              <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">{name}</p>
            )}
            {product?.createdAt && (
              <p className="text-xs text-[var(--sea-ink-soft)]">
                {t('equipmentAdded', {
                  date: new Date(product.createdAt).toLocaleDateString(
                    language,
                  ),
                })}
              </p>
            )}
            {lookupFailed && (
              <button
                type="button"
                className={`${secondary} my-3`}
                onClick={() => void lookupCatalogProduct()}
              >
                {t('equipmentRetry')}
              </button>
            )}
            <label className="mt-5 block space-y-2 text-sm font-semibold">
              {t('labelCategory')}
              <select
                className={field}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as AssetCategory | '')
                  setConnections([])
                  setSelected([])
                }}
              >
                <option value="">{t('uncategorized')}</option>
                {ASSET_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <details className="mt-5 border-t border-[var(--line)] pt-4">
              <summary className="cursor-pointer py-2 text-sm font-semibold">
                {t('equipmentDetails')}
              </summary>
              <div className="mt-3 space-y-4">
                <label className="block space-y-2 text-sm">
                  {t('labelName')}
                  <input
                    className={field}
                    value={name}
                    maxLength={200}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  {t('labelDescription')}
                  <textarea
                    className={field}
                    value={description}
                    rows={3}
                    maxLength={2000}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  {t('labelOwnership')}
                  <select
                    className={field}
                    value={ownership}
                    onChange={(event) =>
                      setOwnership(event.target.value as AssetOwnership)
                    }
                  >
                    <option value="BOAT">{boatName}</option>
                    <option value="ORG">{orgName ?? t('ownershipOrg')}</option>
                    <option value="USER">{t('ownershipUser')}</option>
                    <option value="EXTERNAL">{t('ownershipExternal')}</option>
                  </select>
                </label>
                {ownership === 'USER' && (
                  <label className="block space-y-2 text-sm">
                    {t('labelOwnedBy')}
                    <select
                      className={field}
                      value={ownedByUserId}
                      onChange={(event) => setOwnedByUserId(event.target.value)}
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
                <label className="block space-y-2 text-sm">
                  {t('labelInstalledDate')}
                  <input
                    type="date"
                    className={field}
                    value={installedAt}
                    onChange={(event) => setInstalledAt(event.target.value)}
                  />
                </label>
              </div>
            </details>
            {existing && (
              <div className="mt-5 rounded-2xl bg-[var(--chip-bg)] p-4">
                <p className="mt-0 text-sm leading-relaxed">
                  {t('equipmentExistingHelp')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondary}
                    disabled={!!busy}
                    onClick={() => onOpenExisting(existing)}
                  >
                    {t('open')}
                  </button>
                  <button
                    type="button"
                    className={secondary}
                    disabled={!!busy}
                    onClick={() => void mergeExisting()}
                  >
                    {t('merge')}
                  </button>
                  <button
                    type="button"
                    className={secondary}
                    disabled={!!busy}
                    onClick={() => setAnotherUnit(true)}
                  >
                    {t('equipmentAnotherUnit')}
                  </button>
                </div>
              </div>
            )}
          </>
        ))}
      {step === 'documentPrompt' && (
        <div className="py-7">
          <div className="mb-7 flex size-20 items-center justify-center rounded-3xl bg-[var(--chip-bg)]">
            <FileText className="size-9 stroke-[1.5]" />
          </div>
          {intro(t('equipmentDocumentsPrompt'), t('equipmentDocumentsHelp'))}
        </div>
      )}
      {step === 'documentProgress' && (
        <>
          {researchActive
            ? loading(
                t('equipmentDocumentsProgress'),
                t('equipmentDocumentsProgressHelp'),
              )
            : intro(t('equipmentDocumentsReady'), t('equipmentDocumentsEmpty'))}
          {researchError && !researchActive && (
            <button
              type="button"
              className={secondary}
              onClick={() => void startDocuments()}
            >
              {t('equipmentRetry')}
            </button>
          )}
        </>
      )}
      {step === 'documents' && (
        <>
          {intro(
            t('equipmentDocumentsReady'),
            t('equipmentDocumentsReadyHelp'),
          )}
          {researchActive && (
            <p
              role="status"
              className="mb-5 flex items-center gap-2 text-sm text-[var(--sea-ink-soft)]"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {t('equipmentDocumentsBackground')}
            </p>
          )}
          {documents.length > 0 &&
            languageRank(documents[0].languages, language) === 3 && (
              <p className="text-sm text-[var(--sea-ink-soft)]">
                {t('equipmentEnglishFallback')}
              </p>
            )}
          <div className="space-y-3">
            {[
              ...documents.map((item) => ({
                shared: true,
                id: item.id,
                title: item.title,
                contentUrl: item.contentUrl,
                purpose: item.purpose,
                languages: item.languages,
              })),
              ...privateDocuments.map((item) => ({
                shared: false,
                id: item.url,
                title: item.title,
                contentUrl: item.url,
                purpose: item.purpose,
                languages: [] as string[],
              })),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-4 rounded-2xl border border-[var(--line)] p-4 text-left transition-colors hover:bg-[var(--chip-bg)]"
                onClick={() =>
                  void openBoatDocument(
                    {
                      title: item.title,
                      kind: item.shared ? 'upload' : 'link',
                      mimeType: 'application/pdf',
                      fileName: 'document.pdf',
                      url: item.shared ? null : item.contentUrl,
                      contentUrl: item.contentUrl,
                    },
                    { onOpenViewer: setViewer },
                  ).catch((error) => setNotice(error.message))
                }
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--chip-bg)]">
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block break-words text-sm">
                    {item.title}
                  </strong>
                  <span className="mt-1 block text-xs uppercase text-[var(--sea-ink-soft)]">
                    {item.purpose} {item.languages.join(' · ')}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0" />
              </button>
            ))}
          </div>
          {!documents.length && !privateDocuments.length && (
            <div className="rounded-2xl bg-[var(--chip-bg)] p-6 text-center text-sm leading-relaxed text-[var(--sea-ink-soft)]">
              {t('equipmentDocumentsEmpty')}
            </div>
          )}
        </>
      )}
      {step === 'connectionPrompt' && (
        <div className="py-7">
          <div className="mb-7 flex size-20 items-center justify-center rounded-3xl bg-[var(--chip-bg)]">
            <Network className="size-9 stroke-[1.5]" />
          </div>
          {intro(
            t('equipmentConnectionsPrompt'),
            t('equipmentConnectionsHelp'),
          )}
          {connectionCandidates.length > 0 && (
            <span className="rounded-full bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold">
              {t('equipmentConnectionBoatAssets', {
                count: connectionCandidates.length,
              })}
            </span>
          )}
          <button
            type="button"
            className="mt-6 flex min-h-11 items-center gap-2 text-sm text-[var(--sea-ink-soft)]"
            onClick={() => setStep('documents')}
          >
            <ArrowLeft className="size-4" />
            {t('equipmentBack')}
          </button>
        </div>
      )}
      {step === 'connections' &&
        (busy === 'connections' ? (
          loading(t('equipmentConnectionsSearching'))
        ) : (
          <>
            {intro(
              t('equipmentConnectionsReview'),
              t('equipmentConnectionsReviewHelp'),
            )}
            {connections.length ? (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <label
                    key={connection.assetId}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${selected.includes(connection.assetId) ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]' : 'border-[var(--line)]'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-[var(--sea-ink)]"
                      checked={selected.includes(connection.assetId)}
                      disabled={
                        !!busy ||
                        (!selected.includes(connection.assetId) &&
                          selected.length >= 20)
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, connection.assetId]
                            : selected.filter(
                                (id) => id !== connection.assetId,
                              ),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <strong className="block text-sm">
                        {connectionName(connection)}
                      </strong>
                      <span className="mt-1 block text-sm leading-relaxed text-[var(--sea-ink-soft)]">
                        {connection.reason}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-[var(--chip-bg)] p-5 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
                {t('equipmentConnectionsEmpty')}
              </p>
            )}
            <button
              type="button"
              disabled={!!busy || selected.length >= 20}
              className={`${secondary} mt-5 w-full`}
              onClick={() => setStep('addConnection')}
            >
              <Plus className="size-4" />
              {t('equipmentAddConnection')}
            </button>
            {researchActive && (
              <p className="mt-5 text-xs text-[var(--sea-ink-soft)]">
                {t('equipmentDocumentsBackground')}
              </p>
            )}
          </>
        ))}
      {step === 'addConnection' && (
        <>
          {intro(
            t('equipmentChooseConnection'),
            t('equipmentChooseConnectionHelp'),
          )}
          <div className="space-y-3">
            {networkCandidates.filter(
              (network) => !selected.includes(network.id),
            ).length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                {t('assetConnectionNetworkGroup')}
              </p>
            )}
            {networkCandidates
              .filter((network) => !selected.includes(network.id))
              .map((network) => (
                <label
                  key={network.id}
                  className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border p-4 ${manualId === network.id ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]' : 'border-[var(--line)]'}`}
                >
                  <input
                    type="radio"
                    name="equipment-connection"
                    className="size-5 accent-[var(--sea-ink)]"
                    checked={manualId === network.id}
                    onChange={() => setManualId(network.id)}
                  />
                  <span className="min-w-0">
                    <strong className="block text-sm">{network.name}</strong>
                  </span>
                </label>
              ))}
            {connectionCandidates.filter(
              (asset) => !selected.includes(asset.id),
            ).length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                {t('assetConnectionEquipmentGroup')}
              </p>
            )}
            {connectionCandidates
              .filter((asset) => !selected.includes(asset.id))
              .map((asset) => (
                <label
                  key={asset.id}
                  className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border p-4 ${manualId === asset.id ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]' : 'border-[var(--line)]'}`}
                >
                  <input
                    type="radio"
                    name="equipment-connection"
                    className="size-5 accent-[var(--sea-ink)]"
                    checked={manualId === asset.id}
                    onChange={() => setManualId(asset.id)}
                  />
                  <span className="min-w-0">
                    <strong className="block text-sm">{asset.name}</strong>
                    <span className="mt-1 block text-xs text-[var(--sea-ink-soft)]">
                      {[asset.brand, asset.modelNumber]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </label>
              ))}
          </div>
          {!connectionCandidates.some(
            (asset) => !selected.includes(asset.id),
          ) &&
            !networkCandidates.some(
              (network) => !selected.includes(network.id),
            ) && (
              <p className="text-sm text-[var(--sea-ink-soft)]">
                {t('equipmentNoConnectionCandidates')}
              </p>
            )}
        </>
      )}
      {researchError && stage === 1 && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[var(--chip-bg)] p-4 text-sm"
        >
          {researchError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-[var(--chip-bg)] p-4 text-sm leading-relaxed"
        >
          {notice}
        </p>
      )}
      {viewer && (
        <BoatDocumentViewerModal {...viewer} onClose={() => setViewer(null)} />
      )}
    </EquipmentFlowDialog>
  )
}
