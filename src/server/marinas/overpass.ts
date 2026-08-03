import type { MarinaFeature, MarinaOsmType } from './schema'
import type { GridCell } from './grid'
import { cellSpanDegrees, splitGridCell } from './grid'

const DEFAULT_OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const

/** Known-broken mirrors — never use even when configured in OVERPASS_URL. */
const BLOCKED_OVERPASS_HOSTS = new Set(['overpass.osm.ch'])

const OVERPASS_FETCH_TIMEOUT_MS = 60_000
const MIRROR_SWITCH_DELAY_MS = 2_000
const CELL_WALL_TIMEOUT_MS = 120_000
const MAX_SPLIT_DEPTH = 1
const MIN_CELL_DEGREES = 0.75
export const DEFAULT_CELL_CONCURRENCY = 5
const MAX_FAILED_RETRY_PASSES = 2
const FAILED_RETRY_DELAY_MS = 15_000

type OverpassElement = {
  type: MarinaOsmType
  id: number
  tags?: Record<string, string>
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

type OverpassResponse = {
  elements?: OverpassElement[]
  osm3s?: {
    timestamp_osm_base?: string
  }
}

/** Broken mirrors can return HTTP 200 with empty elements and a non-ISO timestamp. */
export function isBrokenOverpassPayload(payload: OverpassResponse): boolean {
  const timestamp = payload.osm3s?.timestamp_osm_base
  if (timestamp == null) return false
  return !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)
}

export function overpassQueryForCell(cell: GridCell): string {
  const { south, west, north, east } = cell
  return `[out:json][timeout:120];
(
  nwr["leisure"="marina"](${south},${west},${north},${east});
  nwr["seamark:type"="marina"](${south},${west},${north},${east});
);
out center tags;`
}

function marinaName(tags: Record<string, string>): string | null {
  const name = tags.name?.trim() || tags['seamark:name']?.trim()
  return name || null
}

export function overpassElementToMarina(
  element: OverpassElement,
): MarinaFeature | null {
  if (element.type !== 'node' && element.type !== 'way' && element.type !== 'relation') {
    return null
  }

  const lat =
    element.lat ??
    element.center?.lat ??
    null
  const lon =
    element.lon ??
    element.center?.lon ??
    null
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  const tags = element.tags ?? {}
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties: {
      id: `osm:${element.type}/${element.id}`,
      osmType: element.type,
      osmId: element.id,
      name: marinaName(tags),
      tags,
      sources: ['osm'],
    },
  }
}

function isRetryableOverpassStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function isTimeoutError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('timeout') || lower.includes('too busy')
}

function isOverpassOverloadError(message: string): boolean {
  return (
    isTimeoutError(message) ||
    /Overpass (429|502|503|504)/.test(message) ||
    message.includes('invalid dataset timestamp')
  )
}

function isBlockedOverpassUrl(url: string): boolean {
  try {
    return BLOCKED_OVERPASS_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withWallTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function overpassUrls(): string[] {
  return overpassMirrorUrls(process.env.OVERPASS_URL)
}

/** Visible for tests — configured mirror first, then defaults (deduped, blocklist applied). */
export function overpassMirrorUrls(configuredUrl?: string | null): string[] {
  const configured = configuredUrl?.trim()
  const urls = configured
    ? [configured, ...DEFAULT_OVERPASS_URLS]
    : [...DEFAULT_OVERPASS_URLS]
  return [...new Set(urls)].filter((url) => !isBlockedOverpassUrl(url))
}

function isBrokenMirrorError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.includes('invalid dataset timestamp')
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  if (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('abort')
  ) {
    return true
  }
  const cause = error.cause
  if (cause && typeof cause === 'object') {
    if ('code' in cause) {
      const code = String((cause as { code?: string }).code ?? '')
      if (
        code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'ETIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'ABORT_ERR'
      ) {
        return true
      }
    }
    if ('errors' in cause && Array.isArray((cause as { errors?: unknown[] }).errors)) {
      return (cause as { errors: unknown[] }).errors.some(isConnectionError)
    }
  }
  return false
}

function shouldTryNextMirror(error: unknown): boolean {
  if (isConnectionError(error)) return true
  if (isBrokenMirrorError(error)) return true
  if (!(error instanceof Error)) return false
  return /Overpass (429|502|503|504)/.test(error.message)
}

function formatFetchError(error: unknown, url: string): Error {
  if (error instanceof Error) {
    const cause = error.cause
    const causeCode =
      cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code?: string }).code)
        : null
    const detail = causeCode ? `${error.message} (${causeCode})` : error.message
    return new Error(`Overpass request to ${url} failed: ${detail}`)
  }
  return new Error(`Overpass request to ${url} failed: ${String(error)}`)
}

async function fetchOverpassOnce(
  query: string,
  url: string,
): Promise<OverpassResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'logmaster/1.0 (marina tile builder)',
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS),
  })

  const text = await response.text()
  if (!response.ok) {
    if (isRetryableOverpassStatus(response.status)) {
      throw new Error(`Overpass ${response.status}: ${text.slice(0, 240)}`)
    }
    throw new Error(`Overpass failed (${response.status}): ${text.slice(0, 240)}`)
  }

  let payload: OverpassResponse
  try {
    payload = JSON.parse(text) as OverpassResponse
  } catch {
    throw new Error(`Overpass returned non-JSON: ${text.slice(0, 240)}`)
  }

  if (isTimeoutError(text)) {
    throw new Error(`Overpass timeout: ${text.slice(0, 240)}`)
  }

  if (isBrokenOverpassPayload(payload)) {
    throw new Error(
      `Overpass returned invalid dataset timestamp (${payload.osm3s?.timestamp_osm_base ?? 'missing'})`,
    )
  }

  return payload
}

async function fetchOverpassWithRetries(query: string, attempts = 3): Promise<OverpassResponse> {
  const urls = overpassUrls()
  let lastError: unknown

  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const url = urls[urlIndex]
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await fetchOverpassOnce(query, url)
      } catch (error) {
        lastError = formatFetchError(error, url)
        if (shouldTryNextMirror(error)) {
          break
        }
        const retryableStatus =
          error instanceof Error && isTimeoutError(error.message)
        if (!retryableStatus || attempt === attempts - 1) {
          break
        }
        await sleep(1500 * (attempt + 1))
      }
    }
    if (urlIndex < urls.length - 1) {
      await sleep(MIRROR_SWITCH_DELAY_MS)
    }
  }

  const tried = urls.join(', ')
  if (lastError instanceof Error) {
    throw new Error(`${lastError.message}. Tried: ${tried}`)
  }
  throw new Error(`Overpass request failed. Tried: ${tried}`)
}

async function fetchMarinasForCellRecursive(
  cell: GridCell,
  depth = 0,
): Promise<MarinaFeature[]> {
  const query = overpassQueryForCell(cell)
  try {
    const payload = await fetchOverpassWithRetries(query)
    const elements = payload.elements ?? []
    const features: MarinaFeature[] = []
    for (const element of elements) {
      const feature = overpassElementToMarina(element)
      if (feature) features.push(feature)
    }
    return features
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      !isOverpassOverloadError(message) ||
      cellSpanDegrees(cell) <= MIN_CELL_DEGREES ||
      depth >= MAX_SPLIT_DEPTH
    ) {
      throw error
    }
    const parts = splitGridCell(cell)
    const features: MarinaFeature[] = []
    for (const part of parts) {
      features.push(...(await fetchMarinasForCellRecursive(part, depth + 1)))
      await sleep(500)
    }
    return features
  }
}

export type MarinaCellResult = {
  index: number
  total: number
  cell: GridCell
  status: 'ok' | 'failed'
  featureCount: number
  errorCode?: string | null
  pass?: number
}

export function formatOverpassErrorCode(message: string): string {
  const statusMatch = message.match(/Overpass (\d{3})/)
  if (statusMatch) return statusMatch[1]
  const lower = message.toLowerCase()
  if (lower.includes('cell query timed out')) return 'CELL_TIMEOUT'
  if (lower.includes('timeout') || lower.includes('too busy')) return 'TIMEOUT'
  if (lower.includes('invalid dataset timestamp')) return 'BAD_MIRROR'
  if (lower.includes('fetch failed') || lower.includes('econnrefused')) {
    return 'NETWORK'
  }
  return 'ERROR'
}

export function formatMarinaCellLogLine(result: MarinaCellResult): string {
  const bbox = `[${result.cell.south},${result.cell.west},${result.cell.north},${result.cell.east}]`
  const retry =
    result.pass != null && result.pass > 0 ? ` retry-${result.pass}` : ''
  const prefix = `[marinas] cell ${result.index}/${result.total}${retry} ${bbox}`
  if (result.status === 'failed') {
    return `${prefix} FAIL ${result.errorCode ?? 'ERROR'} · ${result.featureCount} features`
  }
  return `${prefix} OK · ${result.featureCount} features`
}

type CellWorkItem = {
  index: number
  cell: GridCell
}

type CellFetchOutcome = {
  item: CellWorkItem
  features: MarinaFeature[]
  error: string | null
}

async function fetchOneCell(cell: GridCell): Promise<{
  features: MarinaFeature[]
  error: string | null
}> {
  try {
    const features = await withWallTimeout(
      fetchMarinasForCellRecursive(cell),
      CELL_WALL_TIMEOUT_MS,
      'Cell query timed out',
    )
    return { features, error: null }
  } catch (error) {
    return {
      features: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fetchCellsInParallel(
  items: CellWorkItem[],
  concurrency: number,
  onOutcome: (outcome: CellFetchOutcome) => void,
  signal?: AbortSignal,
): Promise<CellFetchOutcome[]> {
  if (items.length === 0) return []

  const results: CellFetchOutcome[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      if (signal?.aborted) {
        throw new Error('Job cancelled')
      }
      const slot = nextIndex
      nextIndex += 1
      if (slot >= items.length) return

      const item = items[slot]
      const { features, error } = await fetchOneCell(item.cell)
      const outcome = { item, features, error }
      results[slot] = outcome
      onOutcome(outcome)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export type FetchMarinasOptions = {
  delayMs?: number
  limitCells?: number | null
  concurrency?: number
  signal?: AbortSignal
  onRetryPass?: (info: { pass: number; cellCount: number }) => void
  onCellResult?: (result: MarinaCellResult) => void
}

export async function fetchMarinasForCells(
  cells: GridCell[],
  options: FetchMarinasOptions = {},
): Promise<MarinaFeature[]> {
  const concurrency = options.concurrency ?? DEFAULT_CELL_CONCURRENCY
  const limitedCells =
    options.limitCells != null && options.limitCells > 0
      ? cells.slice(0, options.limitCells)
      : cells

  const total = limitedCells.length
  let pending: CellWorkItem[] = limitedCells.map((cell, index) => ({
    index: index + 1,
    cell,
  }))
  const all: MarinaFeature[] = []

  for (let pass = 0; pass <= MAX_FAILED_RETRY_PASSES; pass++) {
    if (pending.length === 0) break
    if (options.signal?.aborted) {
      throw new Error('Job cancelled')
    }

    if (pass > 0) {
      options.onRetryPass?.({ pass, cellCount: pending.length })
      await sleep(options.delayMs ?? FAILED_RETRY_DELAY_MS)
    }

    const passConcurrency = pass === 0 ? concurrency : 1
    const outcomes = await fetchCellsInParallel(
      pending,
      passConcurrency,
      (outcome) => {
        all.push(...outcome.features)
        options.onCellResult?.({
          index: outcome.item.index,
          total,
          cell: outcome.item.cell,
          status: outcome.error ? 'failed' : 'ok',
          featureCount: outcome.features.length,
          errorCode: outcome.error
            ? formatOverpassErrorCode(outcome.error)
            : null,
          pass,
        })
      },
      options.signal,
    )

    pending = outcomes
      .filter((outcome) => outcome.error)
      .map((outcome) => outcome.item)
  }

  return all
}
