import { Timer } from 'lucide-react'
import { useEffect, useState } from 'react'

export function LastLogEntryTimer({ timestamp }: { timestamp?: string }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!timestamp) return
    const refresh = () => setNow(Date.now())
    refresh()
    const interval = window.setInterval(refresh, 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [timestamp])

  const lastEntry = timestamp ? Date.parse(timestamp) : NaN
  if (!Number.isFinite(lastEntry)) return <span>No entries yet</span>
  const seconds = Math.max(0, Math.floor((now - lastEntry) / 1000))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const pad = (value: number) => String(value).padStart(2, '0')
  const elapsed = `${days ? `${days}d ` : ''}${hours || days ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(seconds % 60)}`

  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-1.5"
      role="timer"
      aria-live="off"
    >
      <Timer className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">{elapsed}</span>
      <span>since last entry</span>
    </span>
  )
}
