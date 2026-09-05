import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { DevComponentLabel } from './DevComponentLabel'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  headerActions?: ReactNode
  headerBelow?: ReactNode
  showKicker?: boolean
  layer?: 'base' | 'overlay'
  devComponentName?: string
}

export function Modal({
  title,
  onClose,
  children,
  headerActions,
  headerBelow,
  showKicker = true,
  layer = 'base',
  devComponentName = 'Modal',
}: ModalProps) {
  const titleId = useId()
  const zClass = layer === 'overlay' ? 'z-[100]' : 'z-[90]'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      data-blocking-overlay
      className={`ios-map-touch-target fixed inset-0 ${zClass} flex items-center justify-center bg-[var(--overlay)] p-3 backdrop-blur-sm`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ios-map-touch-target flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <DevComponentLabel name={devComponentName} />
        <div className="mb-4 flex shrink-0 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              {showKicker ? <p className="island-kicker">logmaster</p> : null}
              <h3 id={titleId} className="m-0 text-xl font-bold text-[var(--sea-ink)]">
                {title}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)]"
              >
                Close
              </button>
            </div>
          </div>
          {headerBelow}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
