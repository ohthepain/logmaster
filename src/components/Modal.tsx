import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useVisualViewportFrame } from '../lib/use-visual-viewport-frame'
import { DevComponentLabel } from './DevComponentLabel'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  headerActions?: ReactNode
  headerBelow?: ReactNode
  showKicker?: boolean
  /** Backdrop tap closes the modal. Default true; keep false for in-progress flows. */
  closeOnOutside?: boolean
  wide?: boolean
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
  closeOnOutside = true,
  wide = false,
  layer = 'base',
  devComponentName = 'Modal',
}: ModalProps) {
  const titleId = useId()
  const zClass = layer === 'overlay' ? 'z-[100]' : 'z-[90]'
  const viewportFrame = useVisualViewportFrame()
  const overlayStyle: CSSProperties | undefined = viewportFrame
    ? {
        top: viewportFrame.top,
        left: viewportFrame.left,
        width: viewportFrame.width,
        height: viewportFrame.height,
      }
    : undefined

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      data-blocking-overlay
      style={overlayStyle}
      className={`ios-map-touch-target fixed ${viewportFrame ? '' : 'inset-0'} ${zClass} overflow-hidden bg-[var(--overlay)] backdrop-blur-sm`}
      onClick={(event) => {
        if (closeOnOutside && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-scroll-host ios-map-touch-target h-full overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
        onClick={(event) => {
          if (closeOnOutside && event.target === event.currentTarget) onClose()
        }}
      >
        <div className="flex min-h-full flex-col justify-end p-3 sm:min-h-min sm:justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ios-map-touch-target flex w-full flex-col rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:my-auto ${wide ? 'max-w-4xl' : 'max-w-xl'} sm:p-6`}
            onClick={(event) => event.stopPropagation()}
          >
            <DevComponentLabel name={devComponentName} />
            <div className="mb-4 flex shrink-0 flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showKicker ? (
                    <p className="island-kicker">logmaster</p>
                  ) : null}
                  <h3
                    id={titleId}
                    className="m-0 text-xl font-bold text-[var(--sea-ink)]"
                  >
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
            <div className="touch-manipulation">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
