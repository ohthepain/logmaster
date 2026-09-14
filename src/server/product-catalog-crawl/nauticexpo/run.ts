import { join } from 'node:path'
import { prisma } from '../../db'
import { crawlNauticExpo } from './crawlers'
import { NAUTICEXPO_SOURCE } from './constants'
import { importStagedProducts, type ImportStats } from './upsert'

export type NauticExpoSeedProfile = 'equipment'

export type NauticExpoCrawlConfig = {
  seedProfile: NauticExpoSeedProfile
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

  let runId = config.resumeRunId ?? null
  let storageDir = config.storageDir ?? null

  if (runId) {
    const existing = await prisma.catalogCrawlRun.findUnique({
      where: { id: runId },
    })
    if (!existing) throw new Error(`Crawl run not found: ${runId}`)
    storageDir = storageDir ?? existing.storagePath ?? join('storage/nauticexpo', runId)
    await prisma.catalogCrawlRun.update({
      where: { id: runId },
      data: {
        status: 'crawling',
        error: null,
        config: config as object,
      },
    })
  } else {
    const run = await prisma.catalogCrawlRun.create({
      data: {
        source: NAUTICEXPO_SOURCE,
        status: 'crawling',
        config: config as object,
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
    const { staged, progress } = await crawlNauticExpo({
      runId,
      storageDir,
      limits: { maxPages, maxProducts, delayMs },
      resume: Boolean(config.resumeRunId),
      log,
      signal: options.signal,
    })

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
        },
      },
    })

    return {
      runId,
      storageDir,
      progress,
      import: importStats,
      dryRun,
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
