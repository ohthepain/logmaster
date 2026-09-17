import { manufacturerUrlForPreset } from './manufacturers'
import type { NauticExpoSeedProfile } from './manufacturers'
import { EQUIPMENT_CATEGORY_SEEDS } from './seeds'

export const NAUTICEXPO_APIFY_ACTOR = 'crawloop~nauticexpo-scraper'

export type ApifyNauticExpoInput = {
  listingUrls?: Array<{ url: string }>
  manufacturerUrls?: Array<{ url: string }>
  startUrls?: Array<{ url: string }>
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

export type BuildApifyInputOptions = {
  maxProducts: number
  maxPages: number
  seedProfile?: NauticExpoSeedProfile
  manufacturerUrls?: string[]
  searchKeywords?: string[]
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

export function buildApifyInput(
  options: BuildApifyInputOptions,
): ApifyNauticExpoInput {
  const manufacturerUrls = [...(options.manufacturerUrls ?? [])]
  const searchKeywords = [...(options.searchKeywords ?? [])]

  if (
    options.seedProfile &&
    options.seedProfile !== 'equipment' &&
    !manufacturerUrls.length
  ) {
    manufacturerUrls.push(manufacturerUrlForPreset(options.seedProfile))
  }

  const base: ApifyNauticExpoInput = {
    fetchDetails: true,
    maxItems: options.maxProducts <= 0 ? 0 : options.maxProducts,
    maxPages: Math.max(1, Math.min(options.maxPages, 50)),
    concurrency: 3,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'FR',
    },
  }

  if (manufacturerUrls.length > 0 || searchKeywords.length > 0) {
    return {
      ...base,
      ...(manufacturerUrls.length > 0
        ? {
            manufacturerUrls: manufacturerUrls.map((url) => ({ url })),
          }
        : {}),
      ...(searchKeywords.length > 0 ? { searchKeywords } : {}),
    }
  }

  return {
    ...base,
    listingUrls: EQUIPMENT_CATEGORY_SEEDS.map((url) => ({ url })),
  }
}

export function describeApifyInputScope(input: ApifyNauticExpoInput): string {
  if (input.manufacturerUrls?.length) {
    const urls = input.manufacturerUrls.map((entry) => entry.url).join(', ')
    return `manufacturer stand(s): ${urls}`
  }
  if (input.searchKeywords?.length) {
    return `search keywords: ${input.searchKeywords.join(', ')}`
  }
  if (input.startUrls?.length) {
    return `${input.startUrls.length} start URL(s)`
  }
  return `${input.listingUrls?.length ?? 0} equipment listing URL(s)`
}

export type ApifyRunMeta = {
  id: string
  status: string
  defaultDatasetId: string
}

type ApifyRunResponse = {
  data: ApifyRunMeta
}

/** Apify statuses that mean the run is still in progress (including queued). */
const APIFY_RUN_IN_PROGRESS = new Set(['READY', 'RUNNING', 'TIMING-OUT'])

export function isApifyRunInProgress(status: string): boolean {
  return APIFY_RUN_IN_PROGRESS.has(status)
}

/** Apify API accepts at most 60s per waitForFinish request (POST or GET). */
export const APIFY_WAIT_FOR_FINISH_MAX_SECONDS = 60

export function apifyWaitChunkSeconds(remainingSeconds: number): number {
  return Math.min(
    APIFY_WAIT_FOR_FINISH_MAX_SECONDS,
    Math.max(1, remainingSeconds),
  )
}

async function fetchApifyRunWithWait(
  apifyRunId: string,
  waitForFinishSeconds: number,
): Promise<ApifyRunMeta> {
  const token = apifyToken()
  const url = new URL(`https://api.apify.com/v2/actor-runs/${apifyRunId}`)
  url.searchParams.set('token', token)
  url.searchParams.set(
    'waitForFinish',
    String(apifyWaitChunkSeconds(waitForFinishSeconds)),
  )

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Apify run wait failed (${response.status})`)
  }
  const payload = (await response.json()) as ApifyRunResponse
  return payload.data
}

export async function startApifyNauticExpoRun(
  input: ApifyNauticExpoInput,
  waitForFinishSeconds = APIFY_WAIT_FOR_FINISH_MAX_SECONDS,
): Promise<{ apifyRunId: string; datasetId: string; status: string }> {
  const token = apifyToken()
  const url = new URL(
    `https://api.apify.com/v2/acts/${NAUTICEXPO_APIFY_ACTOR}/runs`,
  )
  url.searchParams.set('token', token)
  url.searchParams.set(
    'waitForFinish',
    String(apifyWaitChunkSeconds(waitForFinishSeconds)),
  )

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

export async function apifyRunMeta(apifyRunId: string): Promise<ApifyRunMeta> {
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

/**
 * Poll until the run reaches a terminal status. Each HTTP call waits up to 60s
 * (Apify max); repeats until finished or maxWaitSeconds elapses.
 */
export async function waitForApifyRun(
  apifyRunId: string,
  maxWaitSeconds = 3_600,
  options: { log?: (message: string) => void } = {},
): Promise<ApifyRunMeta> {
  const deadline = Date.now() + maxWaitSeconds * 1000
  let meta = await apifyRunMeta(apifyRunId)
  let lastLoggedStatus: string | null = null

  while (isApifyRunInProgress(meta.status)) {
    const remainingSeconds = Math.floor((deadline - Date.now()) / 1000)
    if (remainingSeconds <= 0) {
      throw new Error(
        `Apify run ${apifyRunId} did not finish within ${maxWaitSeconds}s (status=${meta.status}). When it completes on Apify, re-import with --apify-run-id ${apifyRunId}`,
      )
    }
    if (meta.status !== lastLoggedStatus) {
      options.log?.(
        `[nauticexpo] Apify run ${apifyRunId} status=${meta.status}, waiting...`,
      )
      lastLoggedStatus = meta.status
    }
    meta = await fetchApifyRunWithWait(apifyRunId, remainingSeconds)
  }
  return meta
}

export async function startAndWaitForApifyNauticExpoRun(
  input: ApifyNauticExpoInput,
  options: {
    waitForFinishSeconds?: number
    log?: (message: string) => void
  } = {},
): Promise<ApifyRunMeta> {
  const waitForFinishSeconds = options.waitForFinishSeconds ?? 3_600
  const started = await startApifyNauticExpoRun(input, waitForFinishSeconds)
  if (started.status === 'SUCCEEDED') {
    return {
      id: started.apifyRunId,
      status: started.status,
      defaultDatasetId: started.datasetId,
    }
  }
  if (!isApifyRunInProgress(started.status)) {
    throw new Error(
      `Apify run ${started.apifyRunId} ended with status ${started.status}`,
    )
  }
  const meta = await waitForApifyRun(started.apifyRunId, waitForFinishSeconds, {
    log: options.log,
  })
  if (meta.status !== 'SUCCEEDED') {
    throw new Error(
      `Apify run ${started.apifyRunId} ended with status ${meta.status}`,
    )
  }
  return meta
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
