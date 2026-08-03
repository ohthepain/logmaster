import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cancelAdminJob, rerunAdminJob } from '../../lib/admin-api'
import {
  adminJobRerunLabel,
  canCancelAdminJob,
  canRerunAdminJob,
} from '../../lib/admin-jobs'
import { cn } from '../../lib/cn'

type AdminJobActionsMenuProps = {
  jobId: string
  state: string
  inputSummary?: string
  onActionComplete?: () => void
}

export function AdminJobActionsMenu({
  jobId,
  state,
  inputSummary,
  onActionComplete,
}: AdminJobActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
      onActionComplete?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyJobId = async () => {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(jobId)
      toast.success('Job ID copied')
      setOpen(false)
    } catch {
      toast.error('Could not copy job ID')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    if (!globalThis.confirm('Cancel this job?')) return
    void runAction(async () => {
      await cancelAdminJob(jobId)
      toast.success('Job cancelled')
    })
  }

  const handleRerun = () => {
    const label = adminJobRerunLabel(state)
    const detail = inputSummary ? `\n\n${inputSummary}` : ''
    if (!globalThis.confirm(`${label} this job with the same settings?${detail}`)) {
      return
    }
    void runAction(async () => {
      const result = await rerunAdminJob(jobId)
      toast.success(`Queued job ${result.jobId}`)
    })
  }

  const showCancel = canCancelAdminJob(state)
  const showRerun = canRerunAdminJob(state)

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={busy}
        aria-label="Job actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
          'transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
        )}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Job actions"
          className={cn(
            'absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
            'ring-1 ring-[var(--line)]/60',
          )}
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={handleCopyJobId}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
          >
            Copy job ID
          </button>
          {showCancel ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={handleCancel}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
            >
              Cancel
            </button>
          ) : null}
          {showRerun ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={handleRerun}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              {adminJobRerunLabel(state)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
