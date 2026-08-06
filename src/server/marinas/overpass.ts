import type { MarinaFeature, MarinaOsmType } from './schema'
import type { GridCell } from './grid'
import { cellSpanDegrees, splitGridCell } from './grid'

const DEFAULT_OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
] as const

/** Known-broken mirrors — never use even when configured in OVERPASS_URL. */
const BLOCKED_OVERPASS_HOSTS = new Set(['overpass.osm.ch'])

/** Must exceed `[timeout:…]` in Overpass QL (often 120s for dense seamark cells). */
const OVERPASS_FETCH_TIMEOUT_MS = 130_000
const CELL_WALL_TIMEOUT_MS = 120_000
const MAX_SPLIT_DEPTH = 1
const MIN_CELL_DEGREES = 0.75
export const DEFAULT_CELL_CONCURRENCY = 5
/** Absolute cap so a stuck mirror cannot retry forever. */
export const MAX_RETRY_PASSES = 20
const FAILED_RETRY_DELAY_MS = 15_000

type OverpassElement = {
  type: MarinaOsmType
  id: number
  tags?: Record<string, string>
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

export type { OverpassElement }

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

/** Round-robin primary mirror for a grid cell — spreads load across public instances. */
export function primaryOverpassMirrorForCell(
  cellSlot: number,
  urls: readonly string[],
): string {
  if (urls.length === 0) {
    throw new Error('No Overpass mirrors configured')
  }
  const index = ((cellSlot % urls.length) + urls.length) % urls.length
  return urls[index]!
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

function overpassUrls(): string[] {
  return overpassMirrorUrls(process.env.OVERPASS_URL)
}

async function fetchOverpassOnce(
  query: string,
  url: string,
  externalSignal?: AbortSignal,
): Promise<OverpassResponse> {
  const timeoutSignal = AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS)
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'logmaster/1.0 (map tile builder; contact: admin@logmaster.live)',
    },
    body: new URLSearchParams({ data: query }),
    signal,
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

/** Query all mirrors at once; first success wins and cancels the rest. */
async function fetchOverpassRace(
  query: string,
  urls: readonly string[],
): Promise<OverpassResponse> {
  if (urls.length === 0) {
    throw new Error('No Overpass mirrors available for race')
  }
  if (urls.length === 1) {
    try {
      return await fetchOverpassOnce(query, urls[0]!)
    } catch (error) {
      throw formatFetchError(error, urls[0]!)
    }
  }

  return new Promise((resolve, reject) => {
    let pending = urls.length
    let settled = false
    const errors: Error[] = []
    const controllers = urls.map(() => new AbortController())

    for (let index = 0; index < urls.length; index++) {
      const url = urls[index]!
      const abortSignal = controllers[index]!.signal
      void fetchOverpassOnce(query, url, abortSignal)
        .then((result) => {
          if (settled) return
          settled = true
          for (let j = 0; j < controllers.length; j++) {
            if (j !== index) controllers[j]!.abort()
          }
          resolve(result)
        })
        .catch((error) => {
          if (settled) return
          errors.push(formatFetchError(error, url))
          pending -= 1
          if (pending === 0) {
            settled = true
            const tried = urls.join(', ')
            reject(
              new Error(
                `${errors.map((entry) => entry.message).join('; ')}. Tried: ${tried}`,
              ),
            )
          }
        })
    }
  })
}

async function fetchOverpassForCell(
  query: string,
  cellSlot: number,
): Promise<OverpassResponse> {
  const urls = overpassUrls()
  const primary = primaryOverpassMirrorForCell(cellSlot, urls)

  try {
    return await fetchOverpassOnce(query, primary)
  } catch (primaryError) {
    if (!shouldTryNextMirror(primaryError)) {
      throw formatFetchError(primaryError, primary)
    }
  }

  const fallbacks = urls.filter((url) => url !== primary)
  if (fallbacks.length === 0) {
    throw new Error(`Overpass request failed for ${primary}`)
  }

  return fetchOverpassRace(query, fallbacks)
}

async function fetchElementsForCellRecursive(
  cell: GridCell,
  queryForCell: (cell: GridCell) => string,
  cellSlot: number,
  depth = 0,
): Promise<OverpassElement[]> {
  const query = queryForCell(cell)
  try {
    const payload = await fetchOverpassForCell(query, cellSlot)
    return payload.elements ?? []
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
    const elements: OverpassElement[] = []
    for (const part of parts) {
      elements.push(
        ...(await fetchElementsForCellRecursive(part, queryForCell, cellSlot, depth + 1)),
      )
      await sleep(500)
    }
    return elements
  }
}

async function fetchMarinasForCellRecursive(
  cell: GridCell,
  cellSlot: number,
  depth = 0,
): Promise<MarinaFeature[]> {
  const elements = await fetchElementsForCellRecursive(
    cell,
    overpassQueryForCell,
    cellSlot,
    depth,
  )
  const features: MarinaFeature[] = []
  for (const element of elements) {
    const feature = overpassElementToMarina(element)
    if (feature) features.push(feature)
  }
  return features
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

export function shouldScheduleAnotherRetryPass(
  pass: number,
  pendingCount: number,
  passSuccessCount: number,
  maxPasses = MAX_RETRY_PASSES,
): boolean {
  if (pendingCount === 0) return false
  if (pass >= maxPasses) return false
  if (pass > 0 && passSuccessCount === 0) return false
  return true
}

export function formatOverpassErrorCode(message: string): string {
  const statusMatch = message.match(/Overpass (\d{3})/)
  if (statusMatch) return statusMatch[1]
  const lower = message.toLowerCase()
  if (lower.includes('cell query timed out')) return 'CELL_TIMEOUT'
  if (
    lower.includes('aborted due to timeout') ||
    lower.includes('timeout') ||
    lower.includes('too busy')
  ) {
    return 'TIMEOUT'
  }
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

async function fetchOneCellElements(
  cell: GridCell,
  queryForCell: (cell: GridCell) => string,
  cellSlot: number,
): Promise<{ elements: OverpassElement[]; error: string | null }> {
  try {
    const elements = await withWallTimeout(
      fetchElementsForCellRecursive(cell, queryForCell, cellSlot),
      CELL_WALL_TIMEOUT_MS,
      'Cell query timed out',
    )
    return { elements, error: null }
  } catch (error) {
    return {
      elements: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fetchOneCell(
  cell: GridCell,
  cellSlot: number,
): Promise<{
  features: MarinaFeature[]
  error: string | null
}> {
  try {
    const features = await withWallTimeout(
      fetchMarinasForCellRecursive(cell, cellSlot),
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

type ElementFetchOutcome = {
  item: CellWorkItem
  elements: OverpassElement[]
  error: string | null
}

async function fetchElementCellsInParallel(
  items: CellWorkItem[],
  queryForCell: (cell: GridCell) => string,
  concurrency: number,
  pass: number,
  onOutcome: (outcome: ElementFetchOutcome) => void,
  signal?: AbortSignal,
): Promise<ElementFetchOutcome[]> {
  if (items.length === 0) return []

  const results: ElementFetchOutcome[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      if (signal?.aborted) throw new Error('Job cancelled')
      const slot = nextIndex
      nextIndex += 1
      if (slot >= items.length) return

      const item = items[slot]
      const cellSlot = item.index - 1 + pass
      const { elements, error } = await fetchOneCellElements(
        item.cell,
        queryForCell,
        cellSlot,
      )
      const outcome = { item, elements, error }
      results[slot] = outcome
      onOutcome(outcome)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export async function fetchOverpassElementsForCells(
  cells: GridCell[],
  queryForCell: (cell: GridCell) => string,
  options: FetchMarinasOptions = {},
): Promise<OverpassElement[]> {
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
  const all: OverpassElement[] = []

  let pass = 0
  while (pending.length > 0) {
    if (options.signal?.aborted) throw new Error('Job cancelled')

    if (pass > 0) {
      options.onRetryPass?.({ pass, cellCount: pending.length })
      await sleep(options.delayMs ?? FAILED_RETRY_DELAY_MS)
    }

    const passConcurrency = Math.min(concurrency, pending.length)
    const outcomes = await fetchElementCellsInParallel(
      pending,
      queryForCell,
      passConcurrency,
      pass,
      (outcome) => {
        all.push(...outcome.elements)
        options.onCellResult?.({
          index: outcome.item.index,
          total,
          cell: outcome.item.cell,
          status: outcome.error ? 'failed' : 'ok',
          featureCount: outcome.elements.length,
          errorCode: outcome.error
            ? formatOverpassErrorCode(outcome.error)
            : null,
          pass,
        })
      },
      options.signal,
    )

    const passSuccessCount = outcomes.filter((outcome) => !outcome.error).length
    pending = outcomes
      .filter((outcome) => outcome.error)
      .map((outcome) => outcome.item)

    if (!shouldScheduleAnotherRetryPass(pass, pending.length, passSuccessCount)) {
      break
    }
    pass += 1
  }

  return all
}

async function fetchCellsInParallel(
  items: CellWorkItem[],
  concurrency: number,
  pass: number,
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
      const cellSlot = item.index - 1 + pass
      const { features, error } = await fetchOneCell(item.cell, cellSlot)
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

  let pass = 0
  while (pending.length > 0) {
    if (options.signal?.aborted) {
      throw new Error('Job cancelled')
    }

    if (pass > 0) {
      options.onRetryPass?.({ pass, cellCount: pending.length })
      await sleep(options.delayMs ?? FAILED_RETRY_DELAY_MS)
    }

    const passConcurrency = Math.min(concurrency, pending.length)
    const outcomes = await fetchCellsInParallel(
      pending,
      passConcurrency,
      pass,
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

    const passSuccessCount = outcomes.filter((outcome) => !outcome.error).length
    pending = outcomes
      .filter((outcome) => outcome.error)
      .map((outcome) => outcome.item)

    if (!shouldScheduleAnotherRetryPass(pass, pending.length, passSuccessCount)) {
      break
    }
    pass += 1
  }

  return all
}
