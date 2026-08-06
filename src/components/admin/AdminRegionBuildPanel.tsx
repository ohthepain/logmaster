import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  availableLayersForRegion,
  DEFAULT_MAP_REGION_ID,
  formatMapBbox,
  getMapRegion,
  MAP_LAYERS,
  MAP_REGIONS,
  osmPointsDatasetForBuildLayer,
  type MapLayerId,
  type MapRegionId,
} from '../../lib/map-regions'

type QueuedJob = {
  layerId: MapLayerId
  jobId: string
}

type AdminRegionBuildPanelProps = {
  onQueued?: () => void
}

export function AdminRegionBuildPanel({ onQueued }: AdminRegionBuildPanelProps) {
  const [regionId, setRegionId] = useState<MapRegionId>(DEFAULT_MAP_REGION_ID)
  const [selectedLayers, setSelectedLayers] = useState<MapLayerId[]>([])
  const [limitCells, setLimitCells] = useState('')
  const [enqueueing, setEnqueueing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([])

  const region = useMemo(() => getMapRegion(regionId), [regionId])
  const availableLayers = useMemo(
    () => availableLayersForRegion(region),
    [region],
  )
  const overpassSelected = selectedLayers.some((layerId) => {
    const layer = MAP_LAYERS.find((entry) => entry.id === layerId)
    return layer?.overpass === true
  })

  useEffect(() => {
    setSelectedLayers(availableLayers.map((layer) => layer.id))
  }, [availableLayers])

  const toggleLayer = useCallback((layerId: MapLayerId) => {
    setSelectedLayers((current) =>
      current.includes(layerId)
        ? current.filter((id) => id !== layerId)
        : [...current, layerId],
    )
  }, [])

  const queueBuilds = useCallback(
    async (dryRun: boolean) => {
      if (selectedLayers.length === 0) {
        setErr('Select at least one layer to build.')
        return
      }

      setErr(null)
      setQueuedJobs([])
      setEnqueueing(true)

      const parsedLimit = Number(limitCells)
      const limit =
        Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined

      const results: QueuedJob[] = []
      const errors: string[] = []

      try {
        for (const layerId of selectedLayers) {
          if (layerId === 'geonames-cities') {
            const response = await fetch('/api/admin/jobs/geo-features/runs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dryRun, regionId }),
            })
            if (!response.ok) {
              errors.push(await response.text())
              continue
            }
            const payload = (await response.json()) as { jobId: string }
            results.push({ layerId, jobId: payload.jobId })
          }

          if (layerId === 'osm-marinas') {
            const response = await fetch('/api/admin/jobs/marinas/runs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dryRun,
                regionId,
                limitCells: limit ?? null,
              }),
            })
            if (!response.ok) {
              errors.push(await response.text())
              continue
            }
            const payload = (await response.json()) as { jobId: string }
            results.push({ layerId, jobId: payload.jobId })
          }

          const osmDataset = osmPointsDatasetForBuildLayer(layerId)
          if (osmDataset) {
            const response = await fetch('/api/admin/jobs/osm-points/runs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dryRun,
                regionId,
                dataset: osmDataset,
                limitCells: limit ?? null,
              }),
            })
            if (!response.ok) {
              errors.push(await response.text())
              continue
            }
            const payload = (await response.json()) as { jobId: string }
            results.push({ layerId, jobId: payload.jobId })
          }
        }

        if (results.length > 0) {
          setQueuedJobs(results)
          onQueued?.()
        }
        if (errors.length > 0) {
          setErr(errors.join('\n'))
        }
      } catch (error) {
        setErr(error instanceof Error ? error.message : 'Queue request failed')
      } finally {
        setEnqueueing(false)
      }
    },
    [limitCells, onQueued, regionId, selectedLayers],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <label className="flex flex-col gap-2 text-sm text-[var(--sea-ink)]">
          Region
          <select
            value={regionId}
            onChange={(event) =>
              setRegionId(event.target.value as MapRegionId)
            }
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            {MAP_REGIONS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)]/40 p-4">
          <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
            {region.description}
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--sea-ink-soft)]">Bounding box</dt>
              <dd className="m-0 font-mono text-[var(--sea-ink)]">
                {formatMapBbox(region.bbox)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--sea-ink-soft)]">1° tile folders</dt>
              <dd className="m-0 font-mono text-[var(--sea-ink)]">
                ~{region.degreeTileCount.toLocaleString()}
              </dd>
            </div>
            {region.layers['osm-marinas']?.available ? (
              <div>
                <dt className="text-[var(--sea-ink-soft)]">Overpass cells (3°)</dt>
                <dd className="m-0 font-mono text-[var(--sea-ink)]">
                  ~{region.overpassCellCount.toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-[var(--sea-ink)]">
          Layers to build
        </legend>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {MAP_LAYERS.map((layer) => {
            const availability = region.layers[layer.id]
            const disabled = availability?.available !== true
            const checked = !disabled && selectedLayers.includes(layer.id)

            return (
              <li
                key={layer.id}
                className={`rounded-xl border p-4 ${
                  disabled
                    ? 'border-[var(--line)] opacity-60'
                    : checked
                      ? 'border-[var(--sea-accent)]/40 bg-[var(--sea-accent)]/5'
                      : 'border-[var(--line)]'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={disabled || enqueueing}
                    checked={checked}
                    onChange={() => toggleLayer(layer.id)}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium text-[var(--sea-ink)]">
                      {layer.title}
                    </span>
                    <span className="text-sm text-[var(--sea-ink-soft)]">
                      {layer.description}
                    </span>
                    <span className="font-mono text-xs text-[var(--sea-ink-soft)]">
                      {layer.output}
                    </span>
                    {disabled && availability && !availability.available ? (
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        {availability.reason}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {overpassSelected ? (
        <label className="flex w-full max-w-xs flex-col gap-1 text-sm text-[var(--sea-ink)]">
          Limit Overpass cells (optional)
          <input
            type="number"
            min={1}
            value={limitCells}
            onChange={(event) => setLimitCells(event.target.value)}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            placeholder="all"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enqueueing}
          onClick={() => void queueBuilds(false)}
          className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-3 py-2 text-sm font-medium text-[var(--btn-text)] disabled:opacity-60"
        >
          Queue selected builds
        </button>
        <button
          type="button"
          disabled={enqueueing}
          onClick={() => void queueBuilds(true)}
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
        >
          Dry run selected
        </button>
      </div>

      {queuedJobs.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--chip-bg)]/40 p-4 text-sm text-[var(--sea-ink-soft)]">
          <p className="m-0 mb-2 font-medium text-[var(--sea-ink)]">
            Queued {queuedJobs.length} job{queuedJobs.length === 1 ? '' : 's'}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {queuedJobs.map((job) => (
              <li key={`${job.layerId}-${job.jobId}`}>
                {MAP_LAYERS.find((layer) => layer.id === job.layerId)?.title ??
                  job.layerId}{' '}
                · job {job.jobId}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3">
            Monitor progress on{' '}
            <Link
              to="/admin/jobs"
              search={{ tab: 'geo-features' }}
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Map data builds
            </Link>{' '}
            or{' '}
            <Link
              to="/admin/job-management"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Jobs
            </Link>
            .
          </p>
        </div>
      ) : null}

      {err ? <p className="m-0 text-red-700 dark:text-red-300">{err}</p> : null}
    </div>
  )
}
