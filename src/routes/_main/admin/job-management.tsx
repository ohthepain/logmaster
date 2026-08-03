import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { JobOutputViewer } from '../../../components/admin/JobOutputViewer'
import { AdminPageShell } from '../../../components/admin/AdminPageShell'
import type { UnifiedAdminJobRow, UnifiedAdminJobsPayload } from '../../../lib/admin-jobs'
import {
  formatJobCreatedTime,
  formatJobDuration,
  JOB_STATE_STYLES,
} from '../../../lib/admin-jobs'

export const Route = createFileRoute('/_main/admin/job-management')({
  component: AdminJobManagementPage,
})

function StatDot({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`size-2 rounded-full ${color}`} />
      <span className="text-[var(--sea-ink-soft)]">
        <span className="font-mono font-medium text-[var(--sea-ink)]">{value}</span>{' '}
        {label}
      </span>
    </div>
  )
}

function AdminJobManagementPage() {
  const [data, setData] = useState<UnifiedAdminJobsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rerunningId, setRerunningId] = useState<string | null>(null)
  const [outputJob, setOutputJob] = useState<{
    id: string
    title: string
  } | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const response = await fetch('/api/admin/jobs?limit=50')
      if (!response.ok) {
        setErr(await response.text())
        setData(null)
        return
      }
      setData((await response.json()) as UnifiedAdminJobsPayload)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Request failed')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasRunning = data?.jobs.some(
    (job) =>
      job.state === 'active' || job.state === 'created' || job.state === 'retry',
  )

  useEffect(() => {
    if (!hasRunning) return
    const interval = setInterval(() => void load(), 3000)
    return () => clearInterval(interval)
  }, [hasRunning, load])

  const handleRerun = async (job: UnifiedAdminJobRow) => {
    const label = job.state === 'failed' ? 'Retry' : 'Re-run'
    if (
      !globalThis.confirm(
        `${label} this job with the same settings?\n\n${job.input}`,
      )
    ) {
      return
    }
    setActionError(null)
    setRerunningId(job.id)
    try {
      const response = await fetch(
        `/api/admin/jobs/${encodeURIComponent(job.id)}/rerun`,
        { method: 'POST' },
      )
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        setActionError(body.error ?? `${label} failed (${response.status})`)
        return
      }
      await load()
    } finally {
      setRerunningId(null)
    }
  }

  const stats = data?.stats ?? { total: 0, running: 0, completed: 0, failed: 0 }

  return (
    <AdminPageShell
      title="Jobs"
      description="All background job runs across geo features and marinas. Run pnpm worker in a separate terminal to process queued jobs."
    >
      <JobOutputViewer
        jobId={outputJob?.id ?? null}
        title={outputJob?.title ?? ''}
        open={outputJob !== null}
        onClose={() => setOutputJob(null)}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          Queue new builds from{' '}
          <Link
            to="/admin/jobs"
            className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
          >
            Background jobs
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)]"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-6">
        <StatDot color="bg-[var(--sea-ink-soft)]" label="shown" value={stats.total} />
        <StatDot color="bg-[var(--sea-accent)]" label="running" value={stats.running} />
        <StatDot color="bg-emerald-500" label="completed" value={stats.completed} />
        <StatDot color="bg-red-500" label="failed" value={stats.failed} />
      </div>

      {actionError ? (
        <p className="mb-4 text-sm text-red-700 dark:text-red-300">{actionError}</p>
      ) : null}
      {loading && !data ? (
        <p className="text-[var(--sea-ink-soft)]">Loading jobs…</p>
      ) : null}
      {err ? <p className="text-red-700 dark:text-red-300">{err}</p> : null}

      {data && data.jobs.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] px-4 py-12 text-center text-sm text-[var(--sea-ink-soft)]">
          No job runs yet. Queue a build from Background jobs.
        </div>
      ) : null}

      {data && data.jobs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="grid grid-cols-[1fr_120px_88px_minmax(0,1fr)_108px] gap-3 border-b border-[var(--line)] bg-[var(--header-bg)]/50 px-4 py-2.5 font-mono text-[10px] tracking-[0.15em] text-[var(--sea-ink-soft)] uppercase">
            <span>Type / Input</span>
            <span>Status</span>
            <span className="text-right">Duration</span>
            <span>Result</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {data.jobs.map((job) => {
              const canRerun =
                job.state === 'failed' ||
                job.state === 'completed' ||
                job.state === 'cancelled'
              const rerunLabel =
                job.state === 'failed' || job.state === 'cancelled'
                  ? 'Retry'
                  : 'Re-run'
              return (
                <div
                  key={job.id}
                  className="grid grid-cols-[1fr_120px_88px_minmax(0,1fr)_108px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--header-bg)]/30"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--sea-ink)]">
                      {job.typeLabel}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--sea-ink-soft)]">
                      <span className="truncate">{job.input}</span>
                      <span className="text-[var(--sea-ink-soft)]/50">·</span>
                      <span>{formatJobCreatedTime(job.createdOn)}</span>
                    </div>
                    {job.errorMessage ? (
                      <p
                        className="mt-1 line-clamp-2 font-mono text-[11px] leading-snug break-all text-red-700 dark:text-red-300"
                        title={job.errorMessage}
                      >
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-xs ${JOB_STATE_STYLES[job.state] ?? JOB_STATE_STYLES.created}`}
                    >
                      {job.state === 'active' ? (
                        <span className="size-1.5 animate-pulse rounded-full bg-current" />
                      ) : null}
                      {job.state}
                    </span>
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums text-[var(--sea-ink)]">
                    {formatJobDuration(job.durationMs)}
                  </div>
                  <div
                    className="truncate text-sm text-[var(--sea-ink-soft)]"
                    title={job.result ?? undefined}
                  >
                    {job.result ?? '—'}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOutputJob({ id: job.id, title: job.typeLabel })
                      }
                      className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-1 font-mono text-xs text-[var(--sea-ink)]"
                    >
                      Output
                    </button>
                    {canRerun ? (
                      <button
                        type="button"
                        disabled={rerunningId !== null}
                        onClick={() => void handleRerun(job)}
                        className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-2 py-1 font-mono text-xs text-[var(--btn-text)] disabled:opacity-60"
                      >
                        {rerunningId === job.id ? '…' : rerunLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {hasRunning ? (
        <p className="mt-4 text-center text-xs text-[var(--sea-ink-soft)] animate-pulse">
          Auto-refreshing every 3 seconds…
        </p>
      ) : null}
    </AdminPageShell>
  )
}
