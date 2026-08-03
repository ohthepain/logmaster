import { useCallback, useState } from 'react'

type AdminMarinasJobControlsProps = {
  onQueued: () => void
}

export function AdminMarinasJobControls({ onQueued }: AdminMarinasJobControlsProps) {
  const [enqueueing, setEnqueueing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [region, setRegion] = useState<'canada' | 'north-america'>('canada')
  const [limitCells, setLimitCells] = useState('')

  const queueJob = useCallback(
    async (options: {
      dryRun: boolean
      region: 'canada' | 'north-america'
      limitCells?: number
    }) => {
      setErr(null)
      setMsg(null)
      setEnqueueing(true)
      try {
        const r = await fetch('/api/admin/jobs/marinas/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options),
        })
        if (!r.ok) {
          setErr(await r.text())
          return
        }
        const payload = (await r.json()) as { jobId: string }
        setMsg(`Queued job ${payload.jobId}`)
        onQueued()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Queue request failed')
      } finally {
        setEnqueueing(false)
      }
    },
    [onQueued],
  )

  const parsedLimit = Number(limitCells)
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Fetch OSM marinas via Overpass in a 3° grid, then write marinas.json.gz
        into 1° S3 tiles.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
          Region
          <select
            value={region}
            onChange={(e) =>
              setRegion(e.target.value as 'canada' | 'north-america')
            }
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            <option value="canada">Canada (quick test)</option>
            <option value="north-america">North America</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
          Limit cells (optional)
          <input
            type="number"
            min={1}
            value={limitCells}
            onChange={(e) => setLimitCells(e.target.value)}
            className="w-28 rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            placeholder="all"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enqueueing}
          onClick={() =>
            void queueJob({
              dryRun: true,
              region,
              limitCells: limit,
            })
          }
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
        >
          Dry run
        </button>
        <button
          type="button"
          disabled={enqueueing}
          onClick={() =>
            void queueJob({
              dryRun: false,
              region,
              limitCells: limit,
            })
          }
          className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-3 py-2 text-sm font-medium text-[var(--btn-text)] disabled:opacity-60"
        >
          Queue build
        </button>
      </div>
      {msg && <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{msg}</p>}
      {err && <p className="m-0 text-red-700 dark:text-red-300">{err}</p>}
    </div>
  )
}
