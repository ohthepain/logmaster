import { useCallback, useState } from 'react'

type AdminGeoFeaturesJobControlsProps = {
  onQueued: () => void
}

export function AdminGeoFeaturesJobControls({
  onQueued,
}: AdminGeoFeaturesJobControlsProps) {
  const [enqueueing, setEnqueueing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const queueJob = useCallback(
    async (dryRun: boolean) => {
      setErr(null)
      setMsg(null)
      setEnqueueing(true)
      try {
        const r = await fetch('/api/admin/jobs/geo-features/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun }),
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

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Build GeoNames cities5000 into 1° S3 tiles (highres and lowres). Default
        region is Europe.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enqueueing}
          onClick={() => void queueJob(false)}
          className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-3 py-2 text-sm font-medium text-[var(--btn-text)] disabled:opacity-60"
        >
          Queue Europe build
        </button>
        <button
          type="button"
          disabled={enqueueing}
          onClick={() => void queueJob(true)}
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
        >
          Dry run Europe
        </button>
      </div>
      {msg && <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{msg}</p>}
      {err && <p className="m-0 text-red-700 dark:text-red-300">{err}</p>}
    </div>
  )
}
