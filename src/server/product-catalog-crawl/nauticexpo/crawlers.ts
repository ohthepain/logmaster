import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Configuration, RequestQueue } from '@crawlee/core'
import { PlaywrightCrawler } from '@crawlee/playwright'
import type { Prisma } from '../../../../generated/prisma/client'
import { prisma } from '../../db'
import {
  applyStealthInitScript,
  PLAYWRIGHT_LAUNCH_ARGS,
  PLAYWRIGHT_USER_AGENT,
  waitForNauticExpoContent,
} from './browser'
import { NAUTICEXPO_ORIGIN } from './constants'
import {
  extractNauticExpoLinksFromHtml,
  isCloudflareChallenge,
  parseProductHtml,
} from './parsers'
import type { ParsedProduct } from './parsers'
import { normalizeParsedProduct } from './normalize'
import type { StagedProduct } from './normalize'
import { EQUIPMENT_CATEGORY_SEEDS } from './seeds'
import { classifyNauticExpoUrl, shouldCrawlEquipmentUrl } from './urls'
import type { NauticExpoPageType } from './urls'

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
      normalized: input.normalized ?? undefined,
      crawledAt,
      error: input.error ?? undefined,
    },
    update: {
      pageType: input.pageType,
      httpStatus: input.httpStatus ?? undefined,
      contentHash: input.normalized?.contentHash,
      raw: (input.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      normalized: input.normalized ?? undefined,
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

async function processNauticExpoHtml(options: {
  runId: string
  url: string
  html: string
  httpStatus: number | null
  progress: CrawlProgress
  staged: StagedProduct[]
  addUrl: (urls: string | string[]) => Promise<void>
  limits: CrawlLimits
}) {
  const { url, html, httpStatus, progress, staged, addUrl, limits, runId } =
    options
  const pageType = classifyNauticExpoUrl(url)

  // Playwright may keep response.status() === 403 after CF clears; trust page HTML.
  if (isCloudflareChallenge(html)) {
    await stageCrawlPage({
      runId,
      url,
      pageType,
      httpStatus,
      raw: { blocked: true },
      normalized: null,
      error: 'Blocked by origin (Cloudflare challenge)',
    })
    return
  }

  if (pageType === 'product') {
    if (progress.productsParsed >= limits.maxProducts) return
    const parsed = parseProductHtml(html, url)
    if (!parsed) {
      await stageCrawlPage({
        runId,
        url,
        pageType: 'product',
        httpStatus,
        raw: { parseFailed: true },
        normalized: null,
        error: 'Product parse failed',
      })
      return
    }
    await handleParsedProduct(runId, url, httpStatus, parsed, progress, staged)
    return
  }

  const links = extractNauticExpoLinksFromHtml(html, url).filter(
    shouldCrawlEquipmentUrl,
  )
  const productLinks = links.filter(
    (link) => classifyNauticExpoUrl(link) === 'product',
  )
  const otherLinks = links.filter((link) => {
    const linkType = classifyNauticExpoUrl(link)
    return linkType !== 'product' && linkType !== 'other'
  })
  const ordered = [...productLinks, ...otherLinks]
  const toEnqueue: string[] = []
  for (const link of ordered) {
    const linkType = classifyNauticExpoUrl(link)
    if (
      linkType === 'product' &&
      progress.productsParsed >= limits.maxProducts
    ) {
      continue
    }
    toEnqueue.push(link)
  }
  if (toEnqueue.length > 0) {
    await addUrl(toEnqueue)
  }

  await stageCrawlPage({
    runId,
    url,
    pageType,
    httpStatus,
    raw: { linkCount: links.length },
    normalized: null,
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

  const discoveryQueue = await RequestQueue.open('nauticexpo-discovery', {
    config,
  })

  if (!options.resume) {
    await discoveryQueue.addRequest({
      url: `${NAUTICEXPO_ORIGIN}/`,
      label: 'bootstrap',
    })
    for (const url of EQUIPMENT_CATEGORY_SEEDS) {
      await discoveryQueue.addRequest({ url, label: 'seed' })
    }
  }

  const playwright = new PlaywrightCrawler(
    {
      requestQueue: discoveryQueue,
      maxConcurrency: 1,
      maxRequestsPerCrawl: options.limits.maxPages,
      maxRequestRetries: 5,
      retryOnBlocked: true,
      persistCookiesPerSession: true,
      requestHandlerTimeoutSecs: 120,
      navigationTimeoutSecs: 90,
      launchContext: {
        useIncognitoPages: false,
        launchOptions: {
          headless: true,
          args: [...PLAYWRIGHT_LAUNCH_ARGS],
        },
        userAgent: PLAYWRIGHT_USER_AGENT,
      },
      preNavigationHooks: [
        async ({ page, gotoOptions }) => {
          await applyStealthInitScript(page)
          await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9',
          })
          if (gotoOptions && typeof gotoOptions === 'object') {
            ;(gotoOptions as { waitUntil?: string }).waitUntil =
              'domcontentloaded'
          }
        },
      ],
      async requestHandler({ page, request, response, addRequests }) {
        if (options.signal?.aborted) return
        if (progress.pagesCrawled >= options.limits.maxPages) return
        progress.pagesCrawled += 1
        progress.playwrightRetries += 1

        let ready = await waitForNauticExpoContent(page)
        let html = await page.content()
        let httpStatus = response?.status() ?? null

        if (!ready || httpStatus === 403 || isCloudflareChallenge(html)) {
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
          ready = await waitForNauticExpoContent(page)
          html = await page.content()
          httpStatus = page.url() ? 200 : httpStatus
        }

        if (!ready) {
          await stageCrawlPage({
            runId: options.runId,
            url: request.url,
            pageType: classifyNauticExpoUrl(request.url),
            httpStatus,
            raw: { cloudflareTimeout: true },
            normalized: null,
            error: 'Timed out waiting for Cloudflare / page content',
          })
          return
        }

        await processNauticExpoHtml({
          runId: options.runId,
          url: request.url,
          html,
          httpStatus,
          progress,
          staged,
          limits: options.limits,
          addUrl: async (urls) => {
            const list = Array.isArray(urls) ? urls : [urls]
            await addRequests(list.map((url) => ({ url, uniqueKey: url })))
          },
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

  options.log(
    '[nauticexpo] starting Playwright crawl (Cloudflare; retryOnBlocked enabled — initial 403s are retried, not fatal)',
  )
  await playwright.run()

  options.log(
    `[nauticexpo] crawl finished pages=${progress.pagesCrawled} products=${progress.productsParsed}`,
  )

  return { staged, progress }
}
