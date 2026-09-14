import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { CheerioCrawler } from '@crawlee/cheerio'
import { Configuration, RequestQueue } from '@crawlee/core'
import { PlaywrightCrawler } from '@crawlee/playwright'
import type { Prisma } from '../../../../generated/prisma/client'
import { prisma } from '../../db'
import { CATALOG_CRAWL_USER_AGENT } from './constants'
import {
  extractNauticExpoLinksFromHtml,
  isCloudflareChallenge,
  parseProductHtml,
  type ParsedProduct,
} from './parsers'
import { normalizeParsedProduct, type StagedProduct } from './normalize'
import { EQUIPMENT_CATEGORY_SEEDS } from './seeds'
import {
  classifyNauticExpoUrl,
  shouldCrawlEquipmentUrl,
  type NauticExpoPageType,
} from './urls'

export type CrawlLimits = {
  maxPages: number
  maxProducts: number
  delayMs: number
}

export type CrawlProgress = {
  pagesCrawled: number
  productsParsed: number
  playwrightRetries: number
}

type StagePageInput = {
  runId: string
  url: string
  pageType: NauticExpoPageType
  httpStatus: number | null
  raw: Record<string, unknown> | null
  normalized: StagedProduct | null
  error: string | null
}

async function stageCrawlPage(input: StagePageInput) {
  const crawledAt = new Date()
  await prisma.catalogCrawlPage.upsert({
    where: { runId_url: { runId: input.runId, url: input.url } },
    create: {
      runId: input.runId,
      url: input.url,
      pageType: input.pageType,
      httpStatus: input.httpStatus ?? undefined,
      contentHash: input.normalized?.contentHash,
      raw: (input.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      normalized: (input.normalized ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      crawledAt,
      error: input.error ?? undefined,
    },
    update: {
      pageType: input.pageType,
      httpStatus: input.httpStatus ?? undefined,
      contentHash: input.normalized?.contentHash,
      raw: (input.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      normalized: (input.normalized ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      crawledAt,
      error: input.error ?? undefined,
    },
  })
}

async function handleParsedProduct(
  runId: string,
  url: string,
  httpStatus: number | null,
  parsed: ParsedProduct,
  progress: CrawlProgress,
  stagedOut: StagedProduct[],
) {
  const staged = normalizeParsedProduct(parsed, url)
  if (!staged) {
    await stageCrawlPage({
      runId,
      url,
      pageType: 'product',
      httpStatus,
      raw: parsed,
      normalized: null,
      error: 'Could not normalize product',
    })
    return
  }
  progress.productsParsed += 1
  stagedOut.push(staged)
  await stageCrawlPage({
    runId,
    url,
    pageType: 'product',
    httpStatus,
    raw: parsed,
    normalized: staged,
    error: null,
  })
}

export async function crawlNauticExpo(options: {
  runId: string
  storageDir: string
  limits: CrawlLimits
  resume: boolean
  log: (message: string) => void
  signal?: AbortSignal
}): Promise<{ staged: StagedProduct[]; progress: CrawlProgress }> {
  mkdirSync(dirname(options.storageDir), { recursive: true })

  process.env.CRAWLEE_STORAGE_DIR = options.storageDir
  const config = new Configuration({
    purgeOnStart: !options.resume,
  })

  const progress: CrawlProgress = {
    pagesCrawled: 0,
    productsParsed: 0,
    playwrightRetries: 0,
  }
  const staged: StagedProduct[] = []
  const playwrightUrls = new Set<string>()

  const discoveryQueue = await RequestQueue.open('nauticexpo-discovery', {
    config,
  })

  if (!options.resume) {
    for (const url of EQUIPMENT_CATEGORY_SEEDS) {
      await discoveryQueue.addRequest({ url, label: 'seed' })
    }
  }

  const cheerio = new CheerioCrawler(
    {
    requestQueue: discoveryQueue,
    maxConcurrency: 3,
    maxRequestsPerCrawl: options.limits.maxPages,
    minConcurrency: 1,
    requestHandlerTimeoutSecs: 90,
    useSessionPool: true,
    preNavigationHooks: [
      async ({ request }) => {
        request.headers = {
          ...request.headers,
          'user-agent': CATALOG_CRAWL_USER_AGENT,
          'accept-language': 'en',
        }
      },
    ],
    async requestHandler({ request, $, response, addRequests }) {
      if (options.signal?.aborted) return
      if (progress.pagesCrawled >= options.limits.maxPages) return
      progress.pagesCrawled += 1

      const url = request.url
      const pageType = classifyNauticExpoUrl(url)
      const html = $.html()

      if (pageType === 'product') {
        if (progress.productsParsed >= options.limits.maxProducts) return
        const parsed = parseProductHtml(html, url)
        if (!parsed) {
          playwrightUrls.add(url)
          return
        }
        await handleParsedProduct(
          options.runId,
          url,
          response.statusCode ?? null,
          parsed,
          progress,
          staged,
        )
        return
      }

      if (isCloudflareChallenge(html)) {
        playwrightUrls.add(url)
        return
      }

      const links = extractNauticExpoLinksFromHtml(html, url).filter(
        shouldCrawlEquipmentUrl,
      )
      for (const link of links) {
        if (progress.pagesCrawled >= options.limits.maxPages) break
        const linkType = classifyNauticExpoUrl(link)
        if (linkType === 'other') continue
        if (
          linkType === 'product' &&
          progress.productsParsed >= options.limits.maxProducts
        ) {
          continue
        }
        await addRequests([{ url: link }])
      }

      await stageCrawlPage({
        runId: options.runId,
        url,
        pageType,
        httpStatus: response.statusCode ?? null,
        raw: { linkCount: links.length },
        normalized: null,
        error: null,
      })

      if (options.limits.delayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.limits.delayMs),
        )
      }
    },
  },
    config,
  )

  options.log('[nauticexpo] starting Cheerio discovery crawl')
  await cheerio.run()

  if (
    playwrightUrls.size > 0 &&
    progress.productsParsed < options.limits.maxProducts &&
    !options.signal?.aborted
  ) {
    const playwrightQueue = await RequestQueue.open('nauticexpo-playwright', {
      config,
    })
    for (const url of playwrightUrls) {
      if (classifyNauticExpoUrl(url) === 'product') {
        await playwrightQueue.addRequest({ url })
      }
    }

    options.log(
      `[nauticexpo] Playwright fallback for ${playwrightUrls.size} URL(s)`,
    )

    const playwright = new PlaywrightCrawler(
      {
      requestQueue: playwrightQueue,
      maxConcurrency: 1,
      maxRequestsPerCrawl: options.limits.maxProducts - progress.productsParsed,
      launchContext: {
        launchOptions: { headless: true },
      },
      preNavigationHooks: [
        async ({ page }) => {
          await page.setExtraHTTPHeaders({
            'accept-language': 'en',
          })
        },
      ],
      async requestHandler({ page, request, response }) {
        if (options.signal?.aborted) return
        if (progress.productsParsed >= options.limits.maxProducts) return
        progress.playwrightRetries += 1
        await page.waitForLoadState('domcontentloaded')
        const html = await page.content()
        const parsed = parseProductHtml(html, request.url)
        if (!parsed) {
          await stageCrawlPage({
            runId: options.runId,
            url: request.url,
            pageType: 'product',
            httpStatus: response?.status() ?? null,
            raw: { playwright: true },
            normalized: null,
            error: 'Playwright parse failed',
          })
          return
        }
        await handleParsedProduct(
          options.runId,
          request.url,
          response?.status() ?? null,
          parsed,
          progress,
          staged,
        )
      },
    },
      config,
    )

    await playwright.run()
  }

  options.log(
    `[nauticexpo] crawl finished pages=${progress.pagesCrawled} products=${progress.productsParsed}`,
  )

  return { staged, progress }
}
