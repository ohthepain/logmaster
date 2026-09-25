import { useEffect, useRef } from 'react'

export const GIBRALTAR = { longitude: -5.35, latitude: 36.05 }
const WAYPOINTS = [
  GIBRALTAR,
  { longitude: 2.6, latitude: 38.8 },
  { longitude: 8.8, latitude: 39.1 },
  { longitude: 14.6, latitude: 37.5 },
  { longitude: 23.7, latitude: 37.0 },
]

/** Pauses for system prompts, hidden tabs and reduced motion; ends quietly in Greece. */
export function useMediterraneanJourney(
  ready: boolean,
  visible: boolean,
  moving: boolean,
  move: (point: typeof GIBRALTAR) => void | Promise<void>,
) {
  const elapsed = useRef(0)
  useEffect(() => {
    if (!ready || !visible) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let last = performance.now()
    let lastProgress = -1
    const tick = async () => {
      const now = performance.now()
      if (moving && !reducedMotion.matches && !document.hidden)
        elapsed.current += Math.min(now - last, 100)
      last = now
      const progress = Math.min(elapsed.current / 40_000, WAYPOINTS.length - 1)
      const index = Math.min(Math.floor(progress), WAYPOINTS.length - 2)
      const fraction = progress - index
      const from = WAYPOINTS[index]
      const to = WAYPOINTS[index + 1]
      try {
        if (progress !== lastProgress)
          await move({
            longitude:
              from.longitude + (to.longitude - from.longitude) * fraction,
            latitude: from.latitude + (to.latitude - from.latitude) * fraction,
          })
      } catch {
        /* A native map can be destroyed while a camera call is in flight. */
      }
      lastProgress = progress
      if (!cancelled) timer = setTimeout(() => void tick(), 50)
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ready, visible, moving, move])
}
