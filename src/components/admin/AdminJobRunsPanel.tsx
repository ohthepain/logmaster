import { Fragment, useCallback, useEffect, useState } from 'react'
import type { AdminJobRow, AdminJobsPayload } from '../../lib/admin-jobs'
import {
  formatJobCreatedTime,
  formatJobRunInput,
  formatJobRunResult,
  shortJobOutputMessage,
} from '../../lib/admin-jobs'
import { AdminJobActionsMenu } from './AdminJobActionsMenu'
import { JobConsoleLog } from './JobConsoleLog'

type AdminJobRunsPanelProps = {
  queue: string
  formatInput?: (data: Record<string, unknown>) => string
  formatResult?: (output: Record<string, unknown> | undefined) => string | null
  refreshToken?: number
}

export function AdminJobRunsPanel({
  queue,
  formatInput,
  formatResult,
  refreshToken = 0,
}: AdminJobRunsPanelProps) {
  const [data, setData] = useState<AdminJobsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const describeInput =
    formatInput ?? ((jobData: Record<string, unknown>) => formatJobRunInput(queue, jobData))
  const describeResult =
    formatResult ??
    ((output: Record<string, unknown> | undefined) => formatJobRunResult(queue, output))

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setErr(null)
      setLoading(true)
    }
    try {
      const r = await fetch(
        `/api/admin/pgboss/jobs?queue=${encodeURIComponent(queue)}`,
      )
      if (!r.ok) {
        if (!silent) {
          setErr(await r.text())
          setData(null)
        }
        return
      }
      setData((await r.json()) as AdminJobsPayload)
    } catch (e) {
      if (!silent) {
        setErr(e instanceof Error ? e.message : 'Request failed')
        setData(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [queue])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const hasRunningJob =
    data?.jobs.some((job) =>
      ['active', 'created', 'retry'].includes(job.state),
    ) ?? false

  useEffect(() => {
    if (!hasRunningJob) return
    const interval = setInterval(() => void load(true), 5000)
    return () => clearInterval(interval)
  }, [hasRunningJob, load])

  function displayJobState(job: AdminJobRow): string {
    if (job.state === 'active') return 'running'
    if (job.state === 'created') return 'queued'
    return job.state
  }

  const toggleExpanded = (jobId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)]"
        >
          Refresh runs
        </button>
      </div>

      {loading && <p className="text-[var(--sea-ink-soft)]">Loading runs…</p>}
      {err && <p className="text-red-700 dark:text-red-300">{err}</p>}

      {data && (
        <>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--header-bg)]/40 p-4 text-sm text-[var(--sea-ink)]">
            <p className="m-0 font-semibold">Queue: {data.queue}</p>
            <p className="m-0 mt-1 text-[var(--sea-ink-soft)]">
              queued: {data.stats.queuedCount} · active: {data.stats.activeCount}{' '}
              · deferred: {data.stats.deferredCount} · total:{' '}
              {data.stats.totalCount}
            </p>
          </div>

          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--sea-ink-soft)]">
                  <th className="w-10 py-2 pr-2 font-medium" aria-label="Expand" />
                  <th className="py-2 pr-3 font-medium">State</th>
                  <th className="py-2 pr-3 font-medium">Result</th>
                  <th className="py-2 pr-3 font-medium">Input</th>
                  <th className="py-2 pr-3 font-medium">Retries</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="w-10 py-2 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-[var(--sea-ink-soft)]">
                      No runs yet.
                    </td>
                  </tr>
                )}
                {data.jobs.map((job: AdminJobRow) => {
                  const expanded = expandedIds.has(job.id)
                  const result =
                    describeResult(job.output) ??
                    job.outputMessage ??
                    shortJobOutputMessage(job.output, queue)
                  return (
                    <Fragment key={job.id}>
                      <tr className="border-b border-[var(--line)]/60 text-[var(--sea-ink)]">
                        <td className="py-2 pr-2 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(job.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse log' : 'Expand log'}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] text-xs text-[var(--sea-ink)]"
                          >
                            {expanded ? '−' : '+'}
                          </button>
                        </td>
                        <td className="py-2 pr-3 align-top font-mono text-xs">
                          {displayJobState(job)}
                        </td>
                        <td
                          className="max-w-[16rem] py-2 pr-3 align-top text-xs leading-snug"
                          title={result ?? undefined}
                        >
                          {result ?? (
                            <span className="text-[var(--sea-ink-soft)]">—</span>
                          )}
                        </td>
                        <td className="max-w-[14rem] py-2 pr-3 align-top text-xs">
                          {describeInput(job.data)}
                        </td>
                        <td className="py-2 pr-3 align-top text-xs">
                          {job.retryCount}/{job.retryLimit}
                        </td>
                        <td
                          className="whitespace-nowrap py-2 pr-3 align-top text-xs text-[var(--sea-ink-soft)]"
                          title={job.id}
                        >
                          {formatJobCreatedTime(job.createdOn)}
                        </td>
                        <td className="py-2 align-top">
                          <AdminJobActionsMenu
                            jobId={job.id}
                            state={job.state}
                            inputSummary={describeInput(job.data)}
                            onActionComplete={() => void load()}
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-b border-[var(--line)]/60 bg-[var(--header-bg)]/30">
                          <td colSpan={7} className="px-2 py-3">
                            <JobConsoleLog
                              jobId={job.id}
                              state={job.state}
                              output={job.output}
                              queue={queue}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
