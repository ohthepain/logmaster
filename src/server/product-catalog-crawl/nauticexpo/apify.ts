import { EQUIPMENT_CATEGORY_SEEDS } from './seeds'

export const NAUTICEXPO_APIFY_ACTOR = 'crawloop~nauticexpo-scraper'

export type ApifyNauticExpoInput = {
  listingUrls?: Array<{ url: string }>
  searchKeywords?: string[]
  fetchDetails?: boolean
  maxItems?: number
  maxPages?: number
  concurrency?: number
  proxyConfiguration?: {
    useApifyProxy: boolean
    apifyProxyGroups?: string[]
    apifyProxyCountry?: string
  }
}

export function apifyToken(): string {
  const token = process.env.APIFY_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'APIFY_TOKEN is required for Apify NauticExpo crawl. Add it to .env or use --local for Playwright (often blocked by Cloudflare).',
    )
  }
  return token
}

export function buildApifyInput(options: {
  maxProducts: number
  maxPages: number
}): ApifyNauticExpoInput {
  return {
    listingUrls: EQUIPMENT_CATEGORY_SEEDS.map((url) => ({ url })),
    fetchDetails: true,
    maxItems: options.maxProducts,
    maxPages: Math.max(1, Math.min(options.maxPages, 50)),
    concurrency: 3,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'FR',
    },
  }
}

type ApifyRunResponse = {
  data: {
    id: string
    status: string
    defaultDatasetId: string
  }
}

export async function startApifyNauticExpoRun(
  input: ApifyNauticExpoInput,
  waitForFinishSeconds = 3_600,
): Promise<{ apifyRunId: string; datasetId: string; status: string }> {
  const token = apifyToken()
  const url = new URL(
    `https://api.apify.com/v2/acts/${NAUTICEXPO_APIFY_ACTOR}/runs`,
  )
  url.searchParams.set('token', token)
  url.searchParams.set('waitForFinish', String(waitForFinishSeconds))

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Apify actor run failed (${response.status}): ${body}`)
  }
  const payload = (await response.json()) as ApifyRunResponse
  return {
    apifyRunId: payload.data.id,
    datasetId: payload.data.defaultDatasetId,
    status: payload.data.status,
  }
}

export async function apifyRunMeta(apifyRunId: string) {
  const token = apifyToken()
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${apifyRunId}?token=${encodeURIComponent(token)}`,
  )
  if (!response.ok) {
    throw new Error(`Apify run lookup failed (${response.status})`)
  }
  const payload = (await response.json()) as ApifyRunResponse
  return payload.data
}

export async function fetchApifyDatasetItems(
  datasetId: string,
): Promise<Record<string, unknown>[]> {
  const token = apifyToken()
  const items: Record<string, unknown>[] = []
  let offset = 0
  const limit = 1_000
  for (;;) {
    const response = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&offset=${offset}&limit=${limit}`,
    )
    if (!response.ok) {
      throw new Error(`Apify dataset read failed (${response.status})`)
    }
    const batch = (await response.json()) as Record<string, unknown>[]
    if (!Array.isArray(batch) || batch.length === 0) break
    items.push(...batch)
    if (batch.length < limit) break
    offset += batch.length
  }
  return items
}

export async function fetchApifyRunItems(apifyRunId: string) {
  const meta = await apifyRunMeta(apifyRunId)
  const items = await fetchApifyDatasetItems(meta.defaultDatasetId)
  return { meta, items }
}
