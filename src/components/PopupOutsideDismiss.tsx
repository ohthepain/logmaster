import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-passthrough'

/** Full-screen catcher so taps on the map/page close an open popup. */
export const POPUP_OUTSIDE_DISMISS_Z_CLASS = 'z-[80]'

/** Menu surfaces must sit above `PopupOutsideDismiss`. */
export const POPUP_MENU_Z_CLASS = 'z-[90]'

export function PopupOutsideDismiss({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    requestIosMapTouchSync()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      requestIosMapTouchSync()
    }
  }, [onDismiss])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      data-blocking-overlay
      aria-hidden
      className={`fixed inset-0 ${POPUP_OUTSIDE_DISMISS_Z_CLASS}`}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }}
    />,
    document.body,
  )
}
