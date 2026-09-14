import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

/** One persistent dialog keeps focus and the mobile keyboard within the flow. */
export function EquipmentFlowDialog({
  title,
  stage,
  stages,
  stepKey,
  closeLabel,
  onClose,
  children,
  footer,
  suspended = false,
}: {
  title: string
  stage: number
  stages: string[]
  stepKey: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  suspended?: boolean
}) {
  const id = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const paused = useRef(suspended)
  paused.current = suspended
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (paused.current) return
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab') return
      const elements = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) ?? []),
      ].filter((element) => element.getClientRects().length)
      const first = elements[0],
        last = elements[elements.length - 1]
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === heading.current)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    content.current?.scrollTo?.(0, 0)
    heading.current?.focus()
  }, [stepKey])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      data-blocking-overlay
      className="ios-map-touch-target fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm sm:p-6"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="equipment-flow ios-map-touch-target flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-2xl sm:h-[min(780px,calc(100dvh-3rem))] sm:max-w-xl sm:rounded-[2rem] sm:border sm:border-[var(--panel-border)]"
      >
        <header className="shrink-0 px-6 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-7">
          <div className="flex items-center justify-between gap-4">
            <h2
              ref={heading}
              tabIndex={-1}
              id={id}
              className="m-0 text-2xl font-bold tracking-tight outline-none"
            >
              {title}
            </h2>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] hover:bg-[var(--line)]"
            >
              <X className="size-5" />
            </button>
          </div>
          <ol
            aria-label="Progress"
            className="m-0 mt-6 flex list-none gap-2 p-0"
          >
            {stages.map((label, index) => (
              <li
                key={label}
                aria-current={index === stage ? 'step' : undefined}
                className="min-w-0 flex-1"
              >
                <div
                  className={`mb-2 h-1 rounded-full transition-colors ${index <= stage ? 'bg-[var(--sea-ink)]' : 'bg-[var(--line)]'}`}
                />
                <span
                  className={`flex items-center gap-1 text-xs ${index === stage ? 'font-bold' : 'text-[var(--sea-ink-soft)]'}`}
                >
                  {index < stage ? <Check className="size-3" /> : null}
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </header>
        <div
          ref={content}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 sm:px-8"
        >
          <div key={stepKey} className="equipment-flow-step">
            {children}
          </div>
        </div>
        <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-strong)] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6">
          {footer}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
