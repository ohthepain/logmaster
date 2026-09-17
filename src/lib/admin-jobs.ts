import { formatMapBbox, mapRegionLabel } from './map-regions'
import { NAUTICEXPO_MANUFACTURER_PRESETS } from './nauticexpo-manufacturer-presets'

export const BUILD_GEO_FEATURES_QUEUE = 'build_geo_features'
export const BUILD_MARINAS_QUEUE = 'build_marinas'
export const BUILD_OSM_POINTS_QUEUE = 'build_osm_points'
export const PRODUCT_CATALOG_NAUTICEXPO_QUEUE = 'product_catalog_nauticexpo'

export const ADMIN_JOB_CATALOG = [
  {
    id: 'geo-features',
    title: 'Geo features',
    description:
      'GeoNames cities → 1° S3 tiles (highres / lowres) for map place labels.',
    queue: BUILD_GEO_FEATURES_QUEUE,
  },
  {
    id: 'marinas',
    title: 'Marinas',
    description:
      'OSM marinas via Overpass → 1° S3 tiles for tappable marina points.',
    queue: BUILD_MARINAS_QUEUE,
  },
  {
    id: 'osm-points',
    title: 'OSM points',
    description:
      'Harbours, anchorages, coastal places, and seamarks via Overpass → 1° S3 tiles.',
    queue: BUILD_OSM_POINTS_QUEUE,
  },
  {
    id: 'product-catalog-nauticexpo',
    title: 'Product catalog',
    description:
      'NauticExpo crawl via Apify → candidate brands, logos, and catalog products (worker needs APIFY_TOKEN).',
    queue: PRODUCT_CATALOG_NAUTICEXPO_QUEUE,
  },
] as const

export type AdminJobCatalogId = (typeof ADMIN_JOB_CATALOG)[number]['id']

export type AdminJobRow = {
  id: string
  name: string
  state: string
  data: Record<string, unknown>
  priority: number
  retryCount: number
  retryLimit: number
  singletonKey: string | null
  createdOn: string
  startedOn: string | null
  completedOn: string | null
  startAfter: string
  output?: Record<string, unknown>
  outputMessage?: string | null
}

export type AdminJobsPayload = {
  queue: string
  queues: string[]
  stats: {
    name: string
    deferredCount: number
    queuedCount: number
    activeCount: number
    totalCount: number
    table: string
  }
  jobCount: number
  jobsReturned: number
  jobs: AdminJobRow[]
}

function unwrapJobOutput(output: Record<string, unknown> | undefined) {
  if (!output) return null
  if (Array.isArray(output))
    return (output[0] as Record<string, unknown>) ?? null
  if (
    output.value &&
    typeof output.value === 'object' &&
    !Array.isArray(output.value)
  ) {
    return output.value as Record<string, unknown>
  }
  return output
}

export function extractJobLog(
  output: Record<string, unknown> | undefined,
): string | null {
  if (!output) return null
  const candidates = [output, unwrapJobOutput(output)].filter(
    Boolean,
  ) as Record<string, unknown>[]
  for (const candidate of candidates) {
    if (typeof candidate.logs === 'string' && candidate.logs.trim()) {
      return candidate.logs
    }
  }
  return null
}

export function formatGeoFeaturesRunInput(
  data: Record<string, unknown>,
): string {
  const bbox = data.bbox as
    | { west: number; south: number; east: number; north: number }
    | undefined
  const parts = ['GeoNames cities']
  const regionId = data.regionId
  if (typeof regionId === 'string' && regionId.trim()) {
    parts.push(mapRegionLabel(regionId))
  } else if (bbox) {
    parts.push(`bbox ${formatMapBbox(bbox)}`)
  } else {
    parts.push('Europe')
  }
  if (data.dryRun) parts.push('dry run')
  return parts.join(' · ')
}

export function formatMarinasRunInput(data: Record<string, unknown>): string {
  const regionId = data.regionId ?? data.region
  const parts = [
    `Marinas ${mapRegionLabel(String(regionId ?? 'north-america'))}`,
  ]
  parts.push(`${String(data.gridStep ?? 3)}° grid`)
  if (data.limitCells) parts.push(`${String(data.limitCells)} cells`)
  if (data.dryRun) parts.push('dry run')
  return parts.join(' · ')
}

export function formatOsmPointsRunInput(data: Record<string, unknown>): string {
  const dataset = data.dataset ?? 'points'
  const regionId = data.regionId ?? data.region
  const parts = [
    `${String(dataset)} · ${mapRegionLabel(String(regionId ?? 'uk'))}`,
  ]
  parts.push(`${String(data.gridStep ?? 3)}° grid`)
  if (data.limitCells) parts.push(`${String(data.limitCells)} cells`)
  if (data.dryRun) parts.push('dry run')
  return parts.join(' · ')
}

export function formatGeoFeaturesRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    tilesWritten?: number
    highres?: number
    lowres?: number
  }
  if (result.tilesWritten == null && result.highres == null) return null
  const parts = [
    `${result.tilesWritten ?? 0} tiles`,
    `${result.highres ?? 0} highres cities`,
    `${result.lowres ?? 0} lowres cities`,
  ]
  return parts.join(' · ')
}

export function formatMarinasRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    marinasFound?: number
    tilesWritten?: number
    cellsQueried?: number
  }
  if (result.marinasFound == null && result.tilesWritten == null) return null
  const parts = [
    `${result.marinasFound ?? 0} marinas`,
    `${result.tilesWritten ?? 0} tiles`,
    `${result.cellsQueried ?? '?'} cells queried`,
  ]
  return parts.join(' · ')
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function manufacturerUrlLabel(url: string): string {
  const normalized = url.trim()
  for (const preset of Object.values(NAUTICEXPO_MANUFACTURER_PRESETS)) {
    if (
      normalized === preset.manufacturerUrl ||
      normalized.startsWith(preset.manufacturerUrl)
    ) {
      return preset.displayName
    }
  }
  try {
    const last =
      new URL(normalized).pathname.split('/').filter(Boolean).pop() ??
      normalized
    return last.replace(/\.html?$/i, '')
  } catch {
    return normalized
  }
}

function catalogCrawlSeedLabel(data: Record<string, unknown>): string {
  const urls = Array.isArray(data.manufacturerUrls)
    ? data.manufacturerUrls.filter(
        (url): url is string =>
          typeof url === 'string' && url.trim().length > 0,
      )
    : []
  if (urls.length > 0) {
    return urls.map(manufacturerUrlLabel).join(', ')
  }
  const seed =
    typeof data.seedProfile === 'string' && data.seedProfile.trim()
      ? data.seedProfile.trim()
      : 'equipment'
  if (seed === 'equipment') return 'NauticExpo equipment'
  const preset =
    seed in NAUTICEXPO_MANUFACTURER_PRESETS
      ? NAUTICEXPO_MANUFACTURER_PRESETS[
          seed as keyof typeof NAUTICEXPO_MANUFACTURER_PRESETS
        ]
      : null
  return preset ? preset.displayName : `NauticExpo ${seed}`
}

export function storedCatalogCrawlApifyRunId(
  config: unknown,
  stats: unknown,
): string | null {
  const record = jsonRecord(config)
  const statsRecord = jsonRecord(stats)
  for (const value of [record.apifyRunId, statsRecord.apifyRunId]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function formatProductCatalogNauticExpoRunInput(
  data: Record<string, unknown>,
): string {
  const parts = [catalogCrawlSeedLabel(data)]
  if (data.apifyRunId) parts.push(`Apify ${String(data.apifyRunId)}`)
  if (data.dryRun) parts.push('dry run')
  if (data.maxProducts != null)
    parts.push(`${String(data.maxProducts)} products`)
  if (data.maxPages != null) parts.push(`${String(data.maxPages)} pages`)
  if (data.resumeRunId) parts.push(`resume ${String(data.resumeRunId)}`)
  return parts.join(' · ')
}

export const CATALOG_CRAWL_REPEAT_MODES = ['rescrape', 'reimport'] as const
export type CatalogCrawlRepeatMode = (typeof CATALOG_CRAWL_REPEAT_MODES)[number]

export type CatalogCrawlRunSummary = {
  id: string
  source: string
  status: string
  startedAt: string
  completedAt: string | null
  error: string | null
  summary: string
  result: string | null
  apifyRunId: string | null
  canReimport: boolean
}

export function catalogCrawlMatchesQuery(
  crawl: CatalogCrawlRunSummary,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    crawl.summary,
    crawl.status,
    crawl.result,
    crawl.error,
    crawl.apifyRunId,
    crawl.id,
    crawl.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export type CatalogCrawlProductStatus = 'imported' | 'parsed' | 'failed'

export type CatalogCrawlProductPhoto = {
  resourceId: string
  sourceUrl: string
  reviewStatus: string
  isCanonical: boolean
}

export type CatalogCrawlParsedProduct = {
  pageId: string
  url: string
  brand: string | null
  modelNumber: string | null
  error: string | null
  productId: string | null
  status: CatalogCrawlProductStatus
  newThisRun: boolean
  imageUrls: string[]
  canonicalImageId: string | null
  photos: CatalogCrawlProductPhoto[]
}

export type CatalogCrawlRunCrawlSettings = {
  startUrls: string[]
  maxPages: number | null
  maxProducts: number | null
  maxCrawlDepth: number | null
  provider: string | null
  dryRun: boolean
  scopeLabel: string
  pageFunction: string
  configJson: string
}

export type CatalogCrawlRunDetail = CatalogCrawlRunSummary & {
  parsedCount: number
  importedCount: number
  newCount: number
  failedCount: number
  crawlSettings: CatalogCrawlRunCrawlSettings
  products: CatalogCrawlParsedProduct[]
}

function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function optionalFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function catalogCrawlStartUrls(data: Record<string, unknown>): string[] {
  const manufacturerUrls = optionalStringArray(data.manufacturerUrls)
  if (manufacturerUrls.length > 0) return manufacturerUrls
  const seed =
    typeof data.seedProfile === 'string' && data.seedProfile.trim()
      ? data.seedProfile.trim()
      : 'equipment'
  if (seed !== 'equipment' && seed in NAUTICEXPO_MANUFACTURER_PRESETS) {
    return [
      NAUTICEXPO_MANUFACTURER_PRESETS[
        seed as keyof typeof NAUTICEXPO_MANUFACTURER_PRESETS
      ].manufacturerUrl,
    ]
  }
  return []
}

export function catalogCrawlRunCrawlSettings(
  config: unknown,
): CatalogCrawlRunCrawlSettings {
  const data = jsonRecord(config)
  const startUrls = catalogCrawlStartUrls(data)
  const searchKeywords = optionalStringArray(data.searchKeywords)
  const provider =
    typeof data.provider === 'string' && data.provider.trim()
      ? data.provider.trim()
      : data.apifyRunId
        ? 'apify'
        : null
  const scopeLabel = catalogCrawlSeedLabel(data)
  const pageFunction =
    provider === 'apify' || data.apifyRunId
      ? 'Apify crawloop/nauticexpo-scraper: manufacturer or listing seeds → product detail pages (fetchDetails).'
      : 'Local Playwright crawler: follows NauticExpo listing links from seeds, then product pages.'
  const sanitizedConfig = { ...data }
  delete sanitizedConfig.storageDir
  return {
    startUrls,
    maxPages: optionalFiniteNumber(data.maxPages),
    maxProducts: optionalFiniteNumber(data.maxProducts),
    maxCrawlDepth: optionalFiniteNumber(data.maxCrawlDepth),
    provider,
    dryRun: data.dryRun === true,
    scopeLabel,
    pageFunction,
    configJson: JSON.stringify(
      {
        ...sanitizedConfig,
        ...(searchKeywords.length > 0 ? { searchKeywords } : {}),
        ...(startUrls.length === 0 && scopeLabel.includes('equipment')
          ? {
              note: 'Default equipment category listing seeds (see repo seeds.ts)',
            }
          : {}),
      },
      null,
      2,
    ),
  }
}

function imageUrlsFromNormalized(normalized: unknown): string[] {
  const urls = optionalStringArray(jsonRecord(normalized).imageUrls)
  return [...new Set(urls)]
}

export function catalogCrawlInitialPhotoIndex(
  product: Pick<
    CatalogCrawlParsedProduct,
    'imageUrls' | 'photos' | 'canonicalImageId'
  >,
): number {
  const urls = product.imageUrls
  if (urls.length === 0) return 0
  const canonicalPhoto =
    product.photos.find(
      (photo) =>
        photo.isCanonical &&
        photo.reviewStatus === 'verified' &&
        urls.includes(photo.sourceUrl),
    ) ??
    (product.canonicalImageId
      ? product.photos.find(
          (photo) =>
            photo.resourceId === product.canonicalImageId &&
            urls.includes(photo.sourceUrl),
        )
      : null)
  if (!canonicalPhoto) return 0
  return urls.indexOf(canonicalPhoto.sourceUrl)
}

export function catalogCrawlEffectivePhotoIndex(
  product: Pick<
    CatalogCrawlParsedProduct,
    'pageId' | 'imageUrls' | 'photos' | 'canonicalImageId'
  >,
  photoIndexByPageId: Readonly<Record<string, number>>,
): number {
  const override = photoIndexByPageId[product.pageId]
  if (override != null) return override
  return catalogCrawlInitialPhotoIndex(product)
}

export function catalogCrawlSelectedPhoto(
  product: Pick<CatalogCrawlParsedProduct, 'imageUrls' | 'photos'>,
  photoIndex: number,
): CatalogCrawlProductPhoto | null {
  const urls = product.imageUrls
  if (urls.length === 0) return null
  const safeIndex = ((photoIndex % urls.length) + urls.length) % urls.length
  const sourceUrl = urls[safeIndex]
  return product.photos.find((photo) => photo.sourceUrl === sourceUrl) ?? null
}

export function catalogCrawlPhotoNeedsConfirm(
  product: Pick<
    CatalogCrawlParsedProduct,
    'productId' | 'imageUrls' | 'photos'
  >,
  photoIndex: number,
): boolean {
  if (!product.productId) return false
  const photo = catalogCrawlSelectedPhoto(product, photoIndex)
  if (!photo) return false
  return !(photo.isCanonical && photo.reviewStatus === 'verified')
}

export function catalogCrawlProductPhotos(
  imageUrls: string[],
  resources: Array<{
    id: string
    sourceUrl: string
    reviewStatus: string
  }>,
  canonicalImageId: string | null,
): CatalogCrawlProductPhoto[] {
  const byUrl = new Map(
    resources.map((resource) => [resource.sourceUrl, resource]),
  )
  const photos: CatalogCrawlProductPhoto[] = []
  for (const sourceUrl of imageUrls) {
    const resource = byUrl.get(sourceUrl)
    if (!resource) continue
    photos.push({
      resourceId: resource.id,
      sourceUrl: resource.sourceUrl,
      reviewStatus: resource.reviewStatus,
      isCanonical: resource.id === canonicalImageId,
    })
  }
  return photos
}

export function wasDuringCatalogCrawl(
  value: string | Date | null | undefined,
  startedAt: string | Date,
  completedAt: string | Date | null,
): boolean {
  if (value == null) return false
  const time = (value instanceof Date ? value : new Date(value)).getTime()
  const start =
    (startedAt instanceof Date ? startedAt : new Date(startedAt)).getTime() -
    1000
  const end =
    (completedAt == null
      ? Date.now()
      : (completedAt instanceof Date
          ? completedAt
          : new Date(completedAt)
        ).getTime()) + 60_000
  return Number.isFinite(time) && time >= start && time <= end
}

export function catalogCrawlProductFromPage(
  page: {
    id: string
    url: string
    error: string | null
    normalized: unknown
  },
  options: {
    productId?: string | null
    lastCrawledAt?: string | Date | null
    productCreatedAt?: string | Date | null
    runStartedAt: string | Date
    runCompletedAt: string | Date | null
  },
): CatalogCrawlParsedProduct {
  const brand = optionalTrimmedString(jsonRecord(page.normalized).brand)
  const modelNumber = optionalTrimmedString(
    jsonRecord(page.normalized).modelNumber,
  )
  const parsed = Boolean(brand && modelNumber)
  const productId = options.productId ?? null
  const importedThisRun =
    Boolean(productId) &&
    wasDuringCatalogCrawl(
      options.lastCrawledAt,
      options.runStartedAt,
      options.runCompletedAt,
    )
  const newThisRun = wasDuringCatalogCrawl(
    options.productCreatedAt,
    options.runStartedAt,
    options.runCompletedAt,
  )
  return {
    pageId: page.id,
    url: page.url,
    brand,
    modelNumber,
    error: page.error,
    productId,
    status: importedThisRun ? 'imported' : parsed ? 'parsed' : 'failed',
    newThisRun: importedThisRun && newThisRun,
    imageUrls: imageUrlsFromNormalized(page.normalized),
    canonicalImageId: null,
    photos: [],
  }
}

export function catalogCrawlProductMatchesQuery(
  product: CatalogCrawlParsedProduct,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    product.brand,
    product.modelNumber,
    product.url,
    product.error,
    product.status,
    product.newThisRun ? 'new' : null,
    product.productId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function formatCatalogCrawlRunResult(
  stats: Record<string, unknown> | null | undefined,
): string | null {
  if (!stats) return null
  const parts: string[] = []
  if (typeof stats.pagesCrawled === 'number') {
    parts.push(`${stats.pagesCrawled} pages`)
  }
  if (typeof stats.productsParsed === 'number') {
    parts.push(`${stats.productsParsed} products parsed`)
  }
  if (stats.dryRun === true) parts.push('dry run')
  const imported = stats.import
  if (imported && typeof imported === 'object' && !Array.isArray(imported)) {
    const record = imported as Record<string, unknown>
    if (typeof record.products === 'number') {
      parts.push(`${record.products} products imported`)
    }
    if (typeof record.resources === 'number') {
      parts.push(`${record.resources} resources`)
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function summarizeCatalogCrawlRun(row: {
  id: string
  source: string
  status: string
  config: unknown
  stats: unknown
  startedAt: string | Date
  completedAt: string | Date | null
  error: string | null
}): CatalogCrawlRunSummary {
  const config = jsonRecord(row.config)
  const stats = jsonRecord(row.stats)
  const apifyRunId = storedCatalogCrawlApifyRunId(config, stats)
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    startedAt: toIsoString(row.startedAt) ?? '',
    completedAt: toIsoString(row.completedAt),
    error: row.error,
    summary: formatProductCatalogNauticExpoRunInput({
      ...config,
      apifyRunId: apifyRunId ?? config.apifyRunId,
    }),
    result: formatCatalogCrawlRunResult(stats),
    apifyRunId,
    canReimport: Boolean(apifyRunId),
  }
}

export function formatProductCatalogNauticExpoRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    progress?: { pagesCrawled?: number; productsParsed?: number }
    import?: { products?: number; resources?: number } | null
    dryRun?: boolean
  }
  if (result.progress?.pagesCrawled == null) return null
  const parts = [
    `${result.progress.pagesCrawled ?? 0} pages`,
    `${result.progress.productsParsed ?? 0} products parsed`,
  ]
  if (result.dryRun) parts.push('dry run')
  else if (result.import) {
    parts.push(`${result.import.products ?? 0} products imported`)
    parts.push(`${result.import.resources ?? 0} resources`)
  }
  return parts.join(' · ')
}

export function formatOsmPointsRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    featuresFound?: number
    tilesWritten?: number
    cellsQueried?: number
    dataset?: string
  }
  if (result.featuresFound == null && result.tilesWritten == null) return null
  const label = result.dataset ?? 'features'
  const parts = [
    `${result.featuresFound ?? 0} ${label}`,
    `${result.tilesWritten ?? 0} tiles`,
    `${result.cellsQueried ?? '?'} cells queried`,
  ]
  return parts.join(' · ')
}

export function formatJobRunResult(
  queue: string,
  output: Record<string, unknown> | undefined,
): string | null {
  if (queue === BUILD_GEO_FEATURES_QUEUE) {
    return formatGeoFeaturesRunResult(output)
  }
  if (queue === BUILD_MARINAS_QUEUE) {
    return formatMarinasRunResult(output)
  }
  if (queue === BUILD_OSM_POINTS_QUEUE) {
    return formatOsmPointsRunResult(output)
  }
  if (queue === PRODUCT_CATALOG_NAUTICEXPO_QUEUE) {
    return formatProductCatalogNauticExpoRunResult(output)
  }
  return null
}

export function formatJobRunInput(
  queue: string,
  data: Record<string, unknown>,
): string {
  if (queue === BUILD_GEO_FEATURES_QUEUE) {
    return formatGeoFeaturesRunInput(data)
  }
  if (queue === BUILD_MARINAS_QUEUE) {
    return formatMarinasRunInput(data)
  }
  if (queue === BUILD_OSM_POINTS_QUEUE) {
    return formatOsmPointsRunInput(data)
  }
  if (queue === PRODUCT_CATALOG_NAUTICEXPO_QUEUE) {
    return formatProductCatalogNauticExpoRunInput(data)
  }
  return '—'
}

export type UnifiedAdminJobRow = {
  id: string
  queue: string
  type: AdminJobCatalogId
  typeLabel: string
  state: string
  input: string
  result: string | null
  errorMessage: string | null
  createdOn: string
  startedOn: string | null
  completedOn: string | null
  durationMs: number | null
  retryCount: number
  retryLimit: number
  data: Record<string, unknown>
  output?: Record<string, unknown>
}

export type UnifiedAdminJobsPayload = {
  jobs: UnifiedAdminJobRow[]
  stats: {
    total: number
    running: number
    completed: number
    failed: number
  }
}

export const JOB_TYPE_LABELS: Record<AdminJobCatalogId, string> = {
  'geo-features': 'Geo features',
  marinas: 'Marinas',
  'osm-points': 'OSM points',
  'product-catalog-nauticexpo': 'Product catalog',
}

export const JOB_STATE_STYLES: Record<string, string> = {
  created: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  retry: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  active: 'bg-[var(--sea-accent)]/15 text-[var(--sea-accent)]',
  crawling: 'bg-[var(--sea-accent)]/15 text-[var(--sea-accent)]',
  importing: 'bg-[var(--sea-accent)]/15 text-[var(--sea-accent)]',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
  cancelled: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Created column: time if today, "yesterday", or "<n> days ago". */
export function formatJobCreatedTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const diffDays = Math.floor(
    (startOfLocalDay(new Date()) - startOfLocalDay(date)) / 86_400_000,
  )

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  if (diffDays === 1) return 'yesterday'
  return `${diffDays} days ago`
}

export function canCancelAdminJob(state: string): boolean {
  return state === 'created' || state === 'retry' || state === 'active'
}

export function canRerunAdminJob(state: string): boolean {
  return state === 'failed' || state === 'completed' || state === 'cancelled'
}

export function adminJobRerunLabel(state: string): string {
  return state === 'failed' || state === 'cancelled' ? 'Retry' : 'Re-run'
}

export function formatJobRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function formatJobDuration(durationMs: number | null): string {
  if (durationMs == null) return '—'
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  const min = Math.floor(durationMs / 60_000)
  const sec = Math.floor((durationMs % 60_000) / 1000)
  return `${min}m ${sec}s`
}

export function formatJobOutputJson(
  output: Record<string, unknown> | undefined,
): string {
  if (!output) return 'No output recorded.'
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

export function shortJobOutputMessage(
  output: Record<string, unknown> | null | undefined,
  queue?: string,
): string | null {
  if (!output) return null
  if (queue) {
    const summary = formatJobRunResult(queue, output)
    if (summary) return summary
  }
  const top = output.message
  if (typeof top === 'string' && top.trim()) return top.trim()
  const nested = output.error
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const m = (nested as Record<string, unknown>).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  try {
    const raw = JSON.stringify(output)
    if (raw === '{}' || raw === 'null') return null
    return raw.length > 280 ? `${raw.slice(0, 279)}…` : raw
  } catch {
    return null
  }
}
