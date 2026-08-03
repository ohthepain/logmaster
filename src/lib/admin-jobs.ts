export const BUILD_GEO_FEATURES_QUEUE = 'build_geo_features'
export const BUILD_MARINAS_QUEUE = 'build_marinas'

export const ADMIN_JOB_CATALOG = [
  {
    id: 'geo-features',
    title: 'Geo features',
    description:
      'GeoNames cities → 1° S3 tiles (highres / lowres) for map place labels.',
    queue: BUILD_GEO_FEATURES_QUEUE,
  },
  {
    id: 'marinas',
    title: 'Marinas',
    description:
      'OSM marinas via Overpass → 1° S3 tiles for tappable marina points.',
    queue: BUILD_MARINAS_QUEUE,
  },
] as const

export type AdminJobCatalogId = (typeof ADMIN_JOB_CATALOG)[number]['id']

export type AdminJobRow = {
  id: string
  name: string
  state: string
  data: Record<string, unknown>
  priority: number
  retryCount: number
  retryLimit: number
  singletonKey: string | null
  createdOn: string
  startedOn: string | null
  completedOn: string | null
  startAfter: string
  output?: Record<string, unknown>
  outputMessage?: string | null
}

export type AdminJobsPayload = {
  queue: string
  queues: string[]
  stats: {
    name: string
    deferredCount: number
    queuedCount: number
    activeCount: number
    totalCount: number
    table: string
  }
  jobCount: number
  jobsReturned: number
  jobs: AdminJobRow[]
}

function unwrapJobOutput(output: Record<string, unknown> | undefined) {
  if (!output) return null
  if (Array.isArray(output)) return (output[0] as Record<string, unknown>) ?? null
  if (output.value && typeof output.value === 'object' && !Array.isArray(output.value)) {
    return output.value as Record<string, unknown>
  }
  return output
}

export function extractJobLog(
  output: Record<string, unknown> | undefined,
): string | null {
  if (!output) return null
  const candidates = [output, unwrapJobOutput(output)].filter(
    Boolean,
  ) as Record<string, unknown>[]
  for (const candidate of candidates) {
    if (typeof candidate.logs === 'string' && candidate.logs.trim()) {
      return candidate.logs
    }
  }
  return null
}

export function formatGeoFeaturesRunInput(data: Record<string, unknown>): string {
  const bbox = data.bbox as
    | { west: number; south: number; east: number; north: number }
    | undefined
  const parts = ['GeoNames cities']
  if (bbox) {
    parts.push(
      `bbox ${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    )
  } else {
    parts.push('Europe')
  }
  if (data.dryRun) parts.push('dry run')
  return parts.join(' · ')
}

export function formatMarinasRunInput(data: Record<string, unknown>): string {
  const parts = [`Marinas ${String(data.region ?? 'north-america')}`]
  parts.push(`${String(data.gridStep ?? 3)}° grid`)
  if (data.limitCells) parts.push(`${String(data.limitCells)} cells`)
  if (data.dryRun) parts.push('dry run')
  return parts.join(' · ')
}

export function formatGeoFeaturesRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    tilesWritten?: number
    highres?: number
    lowres?: number
  }
  if (result.tilesWritten == null && result.highres == null) return null
  const parts = [
    `${result.tilesWritten ?? 0} tiles`,
    `${result.highres ?? 0} highres cities`,
    `${result.lowres ?? 0} lowres cities`,
  ]
  return parts.join(' · ')
}

export function formatMarinasRunResult(
  output: Record<string, unknown> | undefined,
): string | null {
  const value = unwrapJobOutput(output)
  if (!value) return null
  const result = value as {
    marinasFound?: number
    tilesWritten?: number
    cellsQueried?: number
  }
  if (result.marinasFound == null && result.tilesWritten == null) return null
  const parts = [
    `${result.marinasFound ?? 0} marinas`,
    `${result.tilesWritten ?? 0} tiles`,
    `${result.cellsQueried ?? '?'} cells queried`,
  ]
  return parts.join(' · ')
}

export function formatJobRunResult(
  queue: string,
  output: Record<string, unknown> | undefined,
): string | null {
  if (queue === BUILD_GEO_FEATURES_QUEUE) {
    return formatGeoFeaturesRunResult(output)
  }
  if (queue === BUILD_MARINAS_QUEUE) {
    return formatMarinasRunResult(output)
  }
  return null
}

export function formatJobRunInput(
  queue: string,
  data: Record<string, unknown>,
): string {
  if (queue === BUILD_GEO_FEATURES_QUEUE) {
    return formatGeoFeaturesRunInput(data)
  }
  if (queue === BUILD_MARINAS_QUEUE) {
    return formatMarinasRunInput(data)
  }
  return '—'
}

export type UnifiedAdminJobRow = {
  id: string
  queue: string
  type: AdminJobCatalogId
  typeLabel: string
  state: string
  input: string
  result: string | null
  errorMessage: string | null
  createdOn: string
  startedOn: string | null
  completedOn: string | null
  durationMs: number | null
  retryCount: number
  retryLimit: number
  data: Record<string, unknown>
  output?: Record<string, unknown>
}

export type UnifiedAdminJobsPayload = {
  jobs: UnifiedAdminJobRow[]
  stats: {
    total: number
    running: number
    completed: number
    failed: number
  }
}

export const JOB_TYPE_LABELS: Record<AdminJobCatalogId, string> = {
  'geo-features': 'Geo features',
  marinas: 'Marinas',
}

export const JOB_STATE_STYLES: Record<string, string> = {
  created: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  retry: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
  active: 'bg-[var(--sea-accent)]/15 text-[var(--sea-accent)]',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
  cancelled: 'bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Created column: time if today, "yesterday", or "<n> days ago". */
export function formatJobCreatedTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const diffDays = Math.floor(
    (startOfLocalDay(new Date()) - startOfLocalDay(date)) / 86_400_000,
  )

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  if (diffDays === 1) return 'yesterday'
  return `${diffDays} days ago`
}

export function canCancelAdminJob(state: string): boolean {
  return state === 'created' || state === 'retry' || state === 'active'
}

export function canRerunAdminJob(state: string): boolean {
  return state === 'failed' || state === 'completed' || state === 'cancelled'
}

export function adminJobRerunLabel(state: string): string {
  return state === 'failed' || state === 'cancelled' ? 'Retry' : 'Re-run'
}

export function formatJobRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function formatJobDuration(durationMs: number | null): string {
  if (durationMs == null) return '—'
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  const min = Math.floor(durationMs / 60_000)
  const sec = Math.floor((durationMs % 60_000) / 1000)
  return `${min}m ${sec}s`
}

export function formatJobOutputJson(output: Record<string, unknown> | undefined): string {
  if (!output) return 'No output recorded.'
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

export function shortJobOutputMessage(
  output: Record<string, unknown> | null | undefined,
  queue?: string,
): string | null {
  if (!output) return null
  if (queue) {
    const summary = formatJobRunResult(queue, output)
    if (summary) return summary
  }
  const top = output.message
  if (typeof top === 'string' && top.trim()) return top.trim()
  const nested = output.error
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const m = (nested as Record<string, unknown>).message
    if (typeof m === 'string' && m.trim()) return m.trim()
  }
  try {
    const raw = JSON.stringify(output)
    if (raw === '{}' || raw === 'null') return null
    return raw.length > 280 ? `${raw.slice(0, 279)}…` : raw
  } catch {
    return null
  }
}
