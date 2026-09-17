import { join } from 'node:path'
import { prisma } from '../../db'
import { crawlNauticExpo } from './crawlers'
import { NAUTICEXPO_SOURCE } from './constants'
import { importStagedProducts } from './upsert'
import type { ImportStats } from './upsert'
import { crawlNauticExpoViaApify } from './run-apify'
import { apifyToken } from './apify'
import type { NauticExpoSeedProfile } from './manufacturers'

export type { NauticExpoSeedProfile } from './manufacturers'
export type NauticExpoCrawlProvider = 'apify' | 'local'

export type NauticExpoCrawlConfig = {
  seedProfile: NauticExpoSeedProfile
  manufacturerUrls?: string[] | null
  searchKeywords?: string[] | null
  provider?: NauticExpoCrawlProvider
  apifyRunId?: string | null
  maxProducts?: number | null
  maxPages?: number | null
  dryRun?: boolean
  resumeRunId?: string | null
  storageDir?: string | null
  markMissingRemoved?: boolean
  delayMs?: number
}

export type NauticExpoCrawlResult = {
  runId: string
  storageDir: string
  progress: {
    pagesCrawled: number
    productsParsed: number
    playwrightRetries: number
  }
  import: ImportStats | null
  dryRun: boolean
  provider: NauticExpoCrawlProvider
  apifyRunId?: string | null
}

const DEFAULT_MAX_PAGES = 500
const DEFAULT_MAX_PRODUCTS = 200

export async function runNauticExpoCatalogCrawl(
  config: NauticExpoCrawlConfig,
  options: {
    log?: (message: string) => void
    signal?: AbortSignal
  } = {},
): Promise<NauticExpoCrawlResult> {
  const log = options.log ?? ((message: string) => console.log(message))
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES
  const maxProducts = config.maxProducts ?? DEFAULT_MAX_PRODUCTS
  const dryRun = config.dryRun ?? false
  const delayMs = config.delayMs ?? 750
  const provider: NauticExpoCrawlProvider =
    config.provider ??
    (config.apifyRunId || process.env.APIFY_TOKEN?.trim() ? 'apify' : 'local')

  if (provider === 'apify') {
    apifyToken()
  }

  if (dryRun) {
    log('[nauticexpo] dry-run: staging only — no CatalogProduct import')
  }

  let runId = config.resumeRunId ?? null
  let storageDir = config.storageDir ?? null

  if (runId) {
    const existing = await prisma.catalogCrawlRun.findUnique({
      where: { id: runId },
    })
    if (!existing) throw new Error(`Crawl run not found: ${runId}`)
    storageDir =
      storageDir ?? existing.storagePath ?? join('storage/nauticexpo', runId)
    await prisma.catalogCrawlRun.update({
      where: { id: runId },
      data: {
        status: 'crawling',
        error: null,
        config: config,
      },
    })
  } else {
    const run = await prisma.catalogCrawlRun.create({
      data: {
        source: NAUTICEXPO_SOURCE,
        status: 'crawling',
        config: config,
        storagePath: storageDir ?? undefined,
      },
    })
    runId = run.id
    storageDir = storageDir ?? join('storage/nauticexpo', runId)
    await prisma.catalogCrawlRun.update({
      where: { id: runId },
      data: { storagePath: storageDir },
    })
  }

  log(`[nauticexpo] run ${runId} storage=${storageDir}`)

  try {
    let staged: Awaited<ReturnType<typeof crawlNauticExpo>>['staged']
    let progress: Awaited<ReturnType<typeof crawlNauticExpo>>['progress']
    let apifyRunId: string | null = config.apifyRunId ?? null

    if (provider === 'apify') {
      const apify = await crawlNauticExpoViaApify({
        runId,
        maxProducts,
        maxPages,
        apifyRunId: config.apifyRunId,
        apifyInputOptions: {
          maxProducts,
          maxPages,
          seedProfile: config.seedProfile,
          manufacturerUrls: config.manufacturerUrls ?? undefined,
          searchKeywords: config.searchKeywords ?? undefined,
        },
        log,
      })
      staged = apify.staged
      progress = apify.progress
      apifyRunId = apify.apifyRunId
    } else {
      const local = await crawlNauticExpo({
        runId,
        storageDir,
        limits: { maxPages, maxProducts, delayMs },
        resume: Boolean(config.resumeRunId),
        log,
        signal: options.signal,
      })
      staged = local.staged
      progress = local.progress
    }

    let importStats: ImportStats | null = null
    if (!dryRun && staged.length > 0) {
      await prisma.catalogCrawlRun.update({
        where: { id: runId },
        data: { status: 'importing' },
      })
      importStats = await importStagedProducts(staged, {
        runId,
        markMissingRemoved: config.markMissingRemoved ?? false,
      })
    }

    await prisma.catalogCrawlRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        stats: {
          ...progress,
          staged: staged.length,
          import: importStats,
          dryRun,
          provider,
          apifyRunId,
        },
      },
    })

    if (!dryRun && importStats) {
      log(
        `[nauticexpo] imported ${importStats.products} new products (${importStats.resources} resources)`,
      )
    }

    return {
      runId,
      storageDir,
      progress,
      import: importStats,
      dryRun,
      provider,
      apifyRunId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.catalogCrawlRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: message,
      },
    })
    throw error
  }
}
