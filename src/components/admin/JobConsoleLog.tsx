import { useCallback, useEffect, useRef, useState } from 'react'
import { extractJobLog } from '../../lib/admin-jobs'
import {
  formatMarinaJobProgress,
  marinaJobProgressPercent,
  parseMarinaJobProgress,
} from '../../lib/marina-job-progress'

const RUNNING_STATES = new Set(['active', 'created', 'retry'])
const CONSOLE_HEIGHT_CLASS = 'h-72'

function lineClassName(line: string): string {
  if (/\bdone\b/i.test(line) && line.includes('[marinas]')) {
    return 'text-[#58a6ff]'
  }
  if (/\bupload \d+\/\d+/.test(line)) return 'text-[#d2a8ff]'
  if (/\bFAIL\b/.test(line)) return 'text-[#ff7b72]'
  if (/\bOK\b/.test(line)) return 'text-[#7ee787]'
  return 'text-[#c9d1d9]'
}

function formatJobStateLabel(state: string, logComplete: boolean): string {
  if (logComplete) return 'completed'
  if (state === 'active') return 'running'
  if (state === 'created') return 'queued'
  if (state === 'retry') return 'retrying'
  return state
}

type JobConsoleLogProps = {
  jobId: string
  state: string
  output?: Record<string, unknown>
  queue?: string
}

export function JobConsoleLog({
  jobId,
  state,
  output,
  queue,
}: JobConsoleLogProps) {
  const [log, setLog] = useState<string | null>(null)
  const [jobState, setJobState] = useState(state)
  const [loadError, setLoadError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/jobs/${encodeURIComponent(jobId)}/logs`,
      )
      const body = (await response.json().catch(() => ({}))) as {
        log?: string
        state?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setLog((current) => {
        const next = body.log ?? ''
        return current === next ? current : next
      })
      if (body.state) setJobState(body.state)
      setLoadError(null)
    } catch (error) {
      const fallback = extractJobLog(output)
      if (fallback) {
        setLog((current) => (current === fallback ? current : fallback))
        setLoadError(null)
        return
      }
      setLoadError(error instanceof Error ? error.message : 'Failed to load log')
    }
  }, [jobId, output])

  useEffect(() => {
    setJobState(state)
  }, [state])

  useEffect(() => {
    stickToBottomRef.current = true
    setLoadError(null)
    void load()
  }, [jobId, load])

  const progress = parseMarinaJobProgress(log ?? '')
  const logComplete = progress.complete
  const isRunning =
    !logComplete && RUNNING_STATES.has(jobState)
  const progressLabel = queue?.includes('marina')
    ? formatMarinaJobProgress(progress)
    : null
  const progressPercent = queue?.includes('marina')
    ? marinaJobProgressPercent(progress)
    : null
  const stateLabel = formatJobStateLabel(jobState, logComplete)

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => void load(), 2000)
    return () => clearInterval(interval)
  }, [isRunning, load])

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !stickToBottomRef.current) return
    node.scrollTop = node.scrollHeight
  }, [log])

  const handleScroll = () => {
    const node = scrollRef.current
    if (!node) return
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    stickToBottomRef.current = distanceFromBottom < 48
  }

  const lines = log?.split('\n') ?? []

  return (
    <div
      className={`flex ${CONSOLE_HEIGHT_CLASS} flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117]`}
    >
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-[#30363d] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 font-mono text-[10px] uppercase tracking-wider text-[#8b949e]">
            Console output
          </p>
          <span
            className={`font-mono text-[10px] ${
              logComplete
                ? 'text-[#7ee787]'
                : isRunning
                  ? 'text-[#58a6ff] animate-pulse'
                  : 'text-[#8b949e]'
            }`}
          >
            {logComplete ? 'Finished' : isRunning ? 'Live' : stateLabel}
          </span>
        </div>
        {progressLabel ? (
          <div className="flex flex-col gap-1">
            <p className="m-0 font-mono text-[10px] text-[#c9d1d9]">
              {progressLabel}
            </p>
            {progressPercent != null && !logComplete ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-[#21262d]">
                <div
                  className="h-full rounded-full bg-[#58a6ff] transition-[width] duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {loadError ? (
        <p className="m-0 shrink-0 px-3 py-2 text-xs text-[#ff7b72]">{loadError}</p>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 font-mono text-[11px] leading-relaxed"
      >
        {log == null ? (
          <p className="m-0 text-[#8b949e]">Loading log…</p>
        ) : lines.length === 0 || (lines.length === 1 && !lines[0]?.trim()) ? (
          <p className="m-0 text-[#8b949e]">
            {isRunning ? 'Waiting for output…' : 'No console output recorded for this run.'}
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${index}-${line.slice(0, 24)}`}
              className={`whitespace-pre-wrap break-all ${lineClassName(line)}`}
            >
              {line.length > 0 ? line : '\u00a0'}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
