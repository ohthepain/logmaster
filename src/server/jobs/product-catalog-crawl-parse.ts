import type { CatalogCrawlRepeatMode } from '../../lib/admin-jobs'
import { storedCatalogCrawlApifyRunId } from '../../lib/admin-jobs'
import { resolveSeedProfile } from '../product-catalog-crawl/nauticexpo/manufacturers'
import type { NauticExpoCrawlConfig } from '../product-catalog-crawl/nauticexpo/run'
import type { ProductCatalogNauticExpoPayload } from './product-catalog-crawl'

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const items = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return items.length > 0 ? items : null
}

function parseOptionalInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  return null
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export type ParseProductCatalogCrawlBodyResult =
  | { ok: true; payload: ProductCatalogNauticExpoPayload }
  | { ok: false; error: string }

export function parseProductCatalogCrawlBody(
  body: unknown,
): ParseProductCatalogCrawlBodyResult {
  const record =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}

  const dryRun = record.dryRun === true
  const markMissingRemoved = record.markMissingRemoved === true

  let seedProfile: ProductCatalogNauticExpoPayload['seedProfile'] = 'equipment'
  if (record.seedProfile != null && record.seedProfile !== '') {
    if (typeof record.seedProfile !== 'string') {
      return { ok: false, error: 'seedProfile must be a string' }
    }
    try {
      seedProfile = resolveSeedProfile(record.seedProfile)
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const manufacturerUrls = parseStringArray(record.manufacturerUrls)
  const searchKeywords = parseStringArray(record.searchKeywords)
  const apifyRunId = parseOptionalString(record.apifyRunId)
  const resumeRunId = parseOptionalString(record.resumeRunId)

  const maxProducts = parseOptionalInt(record.maxProducts)
  const maxPages = parseOptionalInt(record.maxPages)

  let provider: NauticExpoCrawlConfig['provider'] | undefined
  if (record.provider === 'apify' || record.provider === 'local') {
    provider = record.provider
  } else if (apifyRunId || !record.provider) {
    provider = 'apify'
  }

  const payload: ProductCatalogNauticExpoPayload = {
    seedProfile,
    manufacturerUrls,
    searchKeywords,
    provider,
    apifyRunId,
    maxProducts,
    maxPages,
    dryRun,
    resumeRunId,
    storageDir: null,
    markMissingRemoved,
  }

  return { ok: true, payload }
}

export function parseCatalogCrawlRepeatMode(
  value: unknown,
): CatalogCrawlRepeatMode | null {
  return value === 'rescrape' || value === 'reimport' ? value : null
}

/** Queue a new worker job from a stored crawl. Drops resume/storage; forces Apify. */
export function payloadFromStoredCrawl(
  config: unknown,
  stats: unknown,
  mode: CatalogCrawlRepeatMode,
): ParseProductCatalogCrawlBodyResult {
  const record =
    typeof config === 'object' && config !== null && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {}
  const apifyRunId = storedCatalogCrawlApifyRunId(config, stats)
  if (mode === 'reimport' && !apifyRunId) {
    return { ok: false, error: 'This crawl has no Apify run to re-import.' }
  }

  return parseProductCatalogCrawlBody({
    seedProfile: record.seedProfile,
    manufacturerUrls: record.manufacturerUrls,
    searchKeywords: record.searchKeywords,
    maxProducts: record.maxProducts,
    maxPages: record.maxPages,
    dryRun: record.dryRun === true,
    markMissingRemoved: record.markMissingRemoved === true,
    provider: 'apify',
    apifyRunId: mode === 'reimport' ? apifyRunId : undefined,
  })
}
