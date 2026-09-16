import { getBoss } from './boss'
import { PG_BOSS_MAX_EXPIRE_SECONDS } from './marina-job-expire'
import {
  PRODUCT_CATALOG_NAUTICEXPO_QUEUE
  
} from './product-catalog-crawl'
import type {ProductCatalogNauticExpoPayload} from './product-catalog-crawl';

/** Apify manufacturer crawls can run longer than default pg-boss job TTL. */
export const PRODUCT_CATALOG_NAUTICEXPO_EXPIRE_SECONDS = Math.min(
  PG_BOSS_MAX_EXPIRE_SECONDS,
  4 * 60 * 60,
)

export function productCatalogNauticExpoSingletonKey(
  payload: ProductCatalogNauticExpoPayload,
): string {
  const manufacturerPart =
    payload.manufacturerUrls?.join('|') ??
    payload.apifyRunId ??
    payload.seedProfile
  return [
    'nauticexpo',
    manufacturerPart,
    payload.dryRun ? 'dry' : 'import',
    payload.maxProducts ?? 'default',
    payload.maxPages ?? 'default',
  ].join(':')
}

export async function enqueueProductCatalogNauticExpo(
  options: Omit<ProductCatalogNauticExpoPayload, 'seedProfile'> & {
    seedProfile?: ProductCatalogNauticExpoPayload['seedProfile']
  } = {},
) {
  const boss = await getBoss()
  const payload: ProductCatalogNauticExpoPayload = {
    seedProfile: options.seedProfile ?? 'equipment',
    manufacturerUrls: options.manufacturerUrls ?? null,
    searchKeywords: options.searchKeywords ?? null,
    provider: options.provider ?? 'apify',
    apifyRunId: options.apifyRunId ?? null,
    maxProducts: options.maxProducts ?? 200,
    maxPages: options.maxPages ?? 50,
    dryRun: options.dryRun ?? false,
    resumeRunId: options.resumeRunId ?? null,
    storageDir: options.storageDir ?? null,
    markMissingRemoved: options.markMissingRemoved ?? false,
    delayMs: options.delayMs ?? 750,
  }
  const singletonKey = productCatalogNauticExpoSingletonKey(payload)
  const id = await boss.send(PRODUCT_CATALOG_NAUTICEXPO_QUEUE, payload, {
    singletonKey,
    retryLimit: 1,
    expireInSeconds: PRODUCT_CATALOG_NAUTICEXPO_EXPIRE_SECONDS,
  })
  return id ?? singletonKey
}
