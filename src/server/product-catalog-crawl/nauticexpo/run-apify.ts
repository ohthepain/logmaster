import type { Prisma } from '../../../../generated/prisma/client'
import { prisma } from '../../db'
import {
  buildApifyInput,
  fetchApifyRunItems,
  startApifyNauticExpoRun,
  type ApifyNauticExpoInput,
} from './apify'
import { apifyItemsToStagedProducts } from './normalize-apify'
import type { StagedProduct } from './normalize'
import type { CrawlProgress } from './crawlers'

async function stageApifyItems(runId: string, items: Record<string, unknown>[]) {
  const crawledAt = new Date()
  for (const item of items) {
    const stagedList = apifyItemsToStagedProducts([item], crawledAt)
    const staged = stagedList[0]
    const sourceUrl =
      typeof item.url === 'string'
        ? item.url
        : typeof item.productUrl === 'string'
          ? item.productUrl
          : staged?.sourceUrl
    if (!sourceUrl) continue
    await prisma.catalogCrawlPage.upsert({
      where: { runId_url: { runId, url: sourceUrl } },
      create: {
        runId,
        url: sourceUrl,
        pageType: 'product',
        raw: item as Prisma.InputJsonValue,
        normalized: (staged ?? undefined) as Prisma.InputJsonValue | undefined,
        crawledAt,
        error: staged ? undefined : 'Could not normalize Apify row',
      },
      update: {
        raw: item as Prisma.InputJsonValue,
        normalized: (staged ?? undefined) as Prisma.InputJsonValue | undefined,
        crawledAt,
        error: staged ? null : 'Could not normalize Apify row',
      },
    })
  }
}

export async function crawlNauticExpoViaApify(options: {
  runId: string
  maxProducts: number
  maxPages: number
  apifyRunId?: string | null
  apifyInput?: ApifyNauticExpoInput
  log: (message: string) => void
}): Promise<{ staged: StagedProduct[]; progress: CrawlProgress; apifyRunId: string }> {
  let apifyRunId = options.apifyRunId ?? null
  let items: Record<string, unknown>[]

  if (apifyRunId) {
    options.log(`[nauticexpo] importing Apify run ${apifyRunId}`)
    const fetched = await fetchApifyRunItems(apifyRunId)
    items = fetched.items
    options.log(
      `[nauticexpo] Apify run status=${fetched.meta.status} items=${items.length}`,
    )
  } else {
    const input = options.apifyInput ?? buildApifyInput(options)
    options.log(
      `[nauticexpo] starting Apify actor ${input.maxItems} items, ${input.maxPages} listing pages`,
    )
    const started = await startApifyNauticExpoRun(input)
    apifyRunId = started.apifyRunId
    options.log(
      `[nauticexpo] Apify run ${apifyRunId} finished with status ${started.status}`,
    )
    const fetched = await fetchApifyRunItems(apifyRunId)
    items = fetched.items
  }

  await stageApifyItems(options.runId, items)
  const staged = apifyItemsToStagedProducts(items)
  const capped = staged.slice(0, options.maxProducts)

  return {
    apifyRunId,
    staged: capped,
    progress: {
      pagesCrawled: items.length,
      productsParsed: capped.length,
      playwrightRetries: 0,
    },
  }
}
