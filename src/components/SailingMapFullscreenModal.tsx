import { X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { SailingMapColors } from '../lib/maplibre-sailing-theme'

type SailingMapFullscreenModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

export function SailingMapFullscreenModal({
  title,
  onClose,
  children,
}: SailingMapFullscreenModalProps) {
  const titleId = useId()

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col"
      style={{ backgroundColor: SailingMapColors.background }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: SailingMapColors.chromeBorder }}
      >
        <h2
          id={titleId}
          className="m-0 text-base font-semibold"
          style={{ color: SailingMapColors.label }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close full-screen map"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition"
          style={{
            borderColor: SailingMapColors.chromeBorder,
            backgroundColor: SailingMapColors.chromeSurface,
            color: SailingMapColors.label,
          }}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  )
}
