import type { Job } from 'pg-boss'
import {
  runNauticExpoCatalogCrawl,
  type NauticExpoCrawlConfig,
  type NauticExpoCrawlResult,
} from '../product-catalog-crawl/nauticexpo/run'
import { createJobLogger } from './job-log'

export const PRODUCT_CATALOG_NAUTICEXPO_QUEUE = 'product_catalog_nauticexpo'

export type ProductCatalogNauticExpoPayload = NauticExpoCrawlConfig

export type ProductCatalogNauticExpoJobResult = NauticExpoCrawlResult & {
  logs: string
}

export async function productCatalogNauticExpoJob(
  payload: ProductCatalogNauticExpoPayload = { seedProfile: 'equipment' },
  jobId?: string,
  signal?: AbortSignal,
): Promise<ProductCatalogNauticExpoJobResult> {
  const logger = jobId ? createJobLogger(jobId) : null
  const log = (message: string) => {
    console.log(message)
    logger?.log(message)
  }
  try {
    const result = await runNauticExpoCatalogCrawl(payload, { log, signal })
    log(`[nauticexpo] done ${JSON.stringify(result)}`)
    await logger?.finish()
    return { ...result, logs: logger?.getText() ?? '' }
  } catch (error) {
    log(
      `[nauticexpo] failed ${error instanceof Error ? error.message : String(error)}`,
    )
    await logger?.finish()
    throw error
  }
}

export async function handleProductCatalogNauticExpoBatches(
  jobs: Job<ProductCatalogNauticExpoPayload>[],
): Promise<ProductCatalogNauticExpoJobResult[]> {
  const results: ProductCatalogNauticExpoJobResult[] = []
  for (const job of jobs) {
    results.push(
      await productCatalogNauticExpoJob(job.data, job.id, job.signal),
    )
  }
  return results
}
