import { Pause, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

type VoiceNotePlaybackProps = {
  src: string
  label?: string
  onRemove?: () => void
  className?: string
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function VoiceNotePlayback({
  src,
  label = 'Voice note',
  onRemove,
  className,
}: VoiceNotePlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
      return
    }
    audio.pause()
    setPlaying(false)
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--panel)] text-[var(--sea-ink)] outline-none transition hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20"
      >
        {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs font-semibold text-[var(--sea-ink)]">{label}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--sea-ink-soft)]">
            {formatDuration(currentTime)}
            {duration > 0 ? ` / ${formatDuration(duration)}` : ''}
          </span>
        </div>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove voice note"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--sea-ink-soft)] outline-none transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)] focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20"
        >
          <X className="size-4" />
        </button>
      ) : null}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="sr-only"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration)
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime)
        }}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(0)
          if (audioRef.current) audioRef.current.currentTime = 0
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
    </div>
  )
}
