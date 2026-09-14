import { getBoss } from './boss'
import { PG_BOSS_MAX_EXPIRE_SECONDS } from './marina-job-expire'
import {
  PRODUCT_CATALOG_NAUTICEXPO_QUEUE,
  type ProductCatalogNauticExpoPayload,
} from './product-catalog-crawl'

export async function enqueueProductCatalogNauticExpo(
  options: Omit<ProductCatalogNauticExpoPayload, 'seedProfile'> & {
    seedProfile?: ProductCatalogNauticExpoPayload['seedProfile']
  } = {},
) {
  const boss = await getBoss()
  const payload: ProductCatalogNauticExpoPayload = {
    seedProfile: 'equipment',
    maxProducts: options.maxProducts ?? 200,
    maxPages: options.maxPages ?? 500,
    dryRun: options.dryRun ?? false,
    resumeRunId: options.resumeRunId ?? null,
    storageDir: options.storageDir ?? null,
    markMissingRemoved: options.markMissingRemoved ?? false,
    delayMs: options.delayMs ?? 750,
  }
  const singletonKey = `nauticexpo:${payload.dryRun ? 'dry' : 'import'}:${payload.maxProducts}:${payload.maxPages}`
  const id = await boss.send(PRODUCT_CATALOG_NAUTICEXPO_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
    expireInSeconds: PG_BOSS_MAX_EXPIRE_SECONDS,
  })
  return id ?? singletonKey
}
