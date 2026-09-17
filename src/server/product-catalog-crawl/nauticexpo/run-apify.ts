import type { Prisma } from '../../../../generated/prisma/client'
import { prisma } from '../../db'
import {
  buildApifyInput,
  describeApifyInputScope,
  fetchApifyDatasetItems,
  fetchApifyRunItems,
  startAndWaitForApifyNauticExpoRun,
} from './apify'
import type { ApifyNauticExpoInput, BuildApifyInputOptions } from './apify'
import { apifyItemsToStagedProducts } from './normalize-apify'
import type { StagedProduct } from './normalize'
import type { CrawlProgress } from './crawlers'

async function stageApifyItems(
  runId: string,
  items: Record<string, unknown>[],
) {
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
        normalized: staged ?? undefined,
        crawledAt,
        error: staged ? undefined : 'Could not normalize Apify row',
      },
      update: {
        raw: item as Prisma.InputJsonValue,
        normalized: staged ?? undefined,
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
  apifyInputOptions?: BuildApifyInputOptions
  log: (message: string) => void
}): Promise<{
  staged: StagedProduct[]
  progress: CrawlProgress
  apifyRunId: string
}> {
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
    const input =
      options.apifyInput ??
      buildApifyInput(
        options.apifyInputOptions ?? {
          maxProducts: options.maxProducts,
          maxPages: options.maxPages,
        },
      )
    options.log(
      `[nauticexpo] starting Apify actor scope=${describeApifyInputScope(input)} maxItems=${input.maxItems ?? 'default'} maxPages=${input.maxPages}`,
    )
    const meta = await startAndWaitForApifyNauticExpoRun(input, {
      log: options.log,
    })
    apifyRunId = meta.id
    options.log(
      `[nauticexpo] Apify run ${apifyRunId} finished with status ${meta.status}`,
    )
    items = await fetchApifyDatasetItems(meta.defaultDatasetId)
  }

  await stageApifyItems(options.runId, items)
  const staged = apifyItemsToStagedProducts(items)
  const normalizeFailures = items.length - staged.length
  if (items.length === 0) {
    options.log(
      '[nauticexpo] Apify dataset is empty — check run on Apify console',
    )
  } else if (staged.length === 0) {
    options.log(
      `[nauticexpo] 0 products normalized from ${items.length} Apify rows (${normalizeFailures} failed)`,
    )
  } else if (normalizeFailures > 0) {
    options.log(
      `[nauticexpo] ${normalizeFailures} Apify row(s) could not be normalized`,
    )
  }
  const capped =
    options.maxProducts <= 0 ? staged : staged.slice(0, options.maxProducts)

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
