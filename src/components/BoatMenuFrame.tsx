import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from '../lib/i18n'

/** One scroll surface for the entire boat menu, above the still-mounted map. */
export function BoatMenuFrame({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation()
  const frame = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    frame.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      )
      if (dialogs[dialogs.length - 1] !== frame.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      }
      if (event.key === 'Tab') {
        const targets = Array.from(
          frame.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
          ) ?? [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 && element.tabIndex >= 0,
        )
        const first = targets[0]
        const last = targets[targets.length - 1]
        if (!first) {
          event.preventDefault()
          return
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === frame.current)
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === frame.current)
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return (
    <div
      data-blocking-overlay
      className="ios-map-touch-target fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-strong)] sm:bg-[var(--overlay)] sm:p-5 sm:backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={frame}
        role="dialog"
        aria-modal="true"
        aria-label={t('boats')}
        tabIndex={-1}
        className="boat-menu-frame h-full w-full overflow-y-auto overscroll-contain bg-[var(--surface-strong)] outline-none sm:h-[calc(100dvh-2.5rem)] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-[var(--panel-border)] sm:shadow-2xl"
      >
        {children}
      </section>
    </div>
  )
}
