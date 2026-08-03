import { useCallback, useEffect, useState } from 'react'
import type { UnifiedAdminJobRow } from '../../lib/admin-jobs'
import {
  formatJobOutputJson,
  formatJobRelativeTime,
  JOB_TYPE_LABELS,
} from '../../lib/admin-jobs'
import { JobConsoleLog } from './JobConsoleLog'

type JobOutputViewerProps = {
  jobId: string | null
  title: string
  open: boolean
  onClose: () => void
}

export function JobOutputViewer({
  jobId,
  title,
  open,
  onClose,
}: JobOutputViewerProps) {
  const [job, setJob] = useState<UnifiedAdminJobRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`)
      const body = (await res.json().catch(() => ({}))) as UnifiedAdminJobRow & {
        error?: string
      }
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setJob(body)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load job')
    }
  }, [jobId])

  useEffect(() => {
    if (!open || !jobId) {
      setJob(null)
      setLoadError(null)
      return
    }
    void load()
    const interval = setInterval(() => void load(), 2000)
    return () => clearInterval(interval)
  }, [open, jobId, load])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !jobId) return null

  const typeLabel = job ? (JOB_TYPE_LABELS[job.type] ?? job.typeLabel) : title

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(88vh,900px)] w-full max-w-4xl flex-col rounded-2xl border border-[var(--line)] bg-[var(--header-bg)] shadow-xl"
        role="dialog"
        aria-labelledby="job-output-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="job-output-title"
              className="truncate text-sm font-semibold text-[var(--sea-ink)]"
            >
              Output — {typeLabel}
            </h2>
            <p
              className="mt-0.5 truncate font-mono text-[11px] text-[var(--sea-ink-soft)]"
              title={jobId}
            >
              {jobId}
              {job ? (
                <span className="text-[var(--sea-ink-soft)]/70">
                  {' '}
                  · {job.state}
                  {job.result ? ` · ${job.result}` : ''}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-medium text-[var(--sea-ink)]"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {loadError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          ) : null}

          {job?.errorMessage ? (
            <div className="shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
                Error
              </p>
              <p className="whitespace-pre-wrap break-all font-mono text-xs text-red-700 dark:text-red-300">
                {job.errorMessage}
              </p>
            </div>
          ) : null}

          {job ? (
            <p className="m-0 shrink-0 text-sm text-[var(--sea-ink-soft)]">
              {job.input}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto">
            <JobConsoleLog
            jobId={jobId}
            state={job?.state ?? 'created'}
            output={job?.output}
            />
          </div>

          <details className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--header-bg)]/50">
            <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--sea-ink-soft)]">
              Raw output JSON
            </summary>
            <pre className="m-0 max-h-48 overflow-auto border-t border-[var(--line)] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--sea-ink)] break-all">
              {job ? formatJobOutputJson(job.output) : 'Loading…'}
            </pre>
          </details>

          {job ? (
            <p className="m-0 shrink-0 px-1 text-[10px] text-[var(--sea-ink-soft)]">
              Created {formatJobRelativeTime(job.createdOn)}
              {job.startedOn ? ` · started ${formatJobRelativeTime(job.startedOn)}` : ''}
              {job.completedOn
                ? ` · completed ${formatJobRelativeTime(job.completedOn)}`
                : ''}
              {job.state === 'active' || job.state === 'created' || job.state === 'retry'
                ? ' · refreshes every 2s while running'
                : ''}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
