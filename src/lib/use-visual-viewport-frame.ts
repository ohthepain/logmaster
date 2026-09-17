import { useEffect, useState } from 'react'

export type VisualViewportFrame = {
  top: number
  left: number
  width: number
  height: number
}

function readVisualViewportFrame(): VisualViewportFrame | null {
  if (typeof window === 'undefined') return null
  const viewport = window.visualViewport
  if (!viewport) return null
  return {
    top: viewport.offsetTop,
    left: viewport.offsetLeft,
    width: viewport.width,
    height: viewport.height,
  }
}

/** Pin fixed overlays to the visible viewport (iOS keyboard-safe). */
export function useVisualViewportFrame(): VisualViewportFrame | null {
  const [frame, setFrame] = useState(readVisualViewportFrame)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const sync = () => setFrame(readVisualViewportFrame())
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  return frame
}
