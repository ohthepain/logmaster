import { FileText, Pause } from 'lucide-react'
import { useAppOptionsStore } from '../stores/app-options'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { DevComponentLabel } from './DevComponentLabel'

const SHEET_CHROME_BUTTON_CLASS =
  'ios-map-touch-target flex size-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition'

type TripRecordButtonProps = {
  tripId: string
  onLogEntryClick?: () => void
  logEntryDisabled?: boolean
}

export function TripRecordButton({
  tripId,
  onLogEntryClick,
  logEntryDisabled = false,
}: TripRecordButtonProps) {
  const recordingTripId = useAppOptionsStore((state) => state.recordingTripId)
  const setRecordingTripId = useAppOptionsStore(
    (state) => state.setRecordingTripId,
  )
  const { t } = useTranslation()
  const recording = recordingTripId === tripId
  const label = recording ? t('pauseRecording') : t('startRecording')

  return (
    <div className="relative flex items-center gap-2">
      <DevComponentLabel
        name="TripRecordButton"
        className="absolute -left-1 -top-5 z-40"
      />
      <button
        type="button"
        aria-pressed={recording}
        aria-label={label}
        title={label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setRecordingTripId(recording ? null : tripId)
        }}
        className={cn(
          SHEET_CHROME_BUTTON_CLASS,
          recording
            ? 'border-transparent bg-[#ff686b] text-white'
            : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)]',
        )}
      >
        {recording ? (
          <Pause className="size-4 fill-current" aria-hidden />
        ) : (
          <span className="size-3.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" />
        )}
      </button>
      {recording && onLogEntryClick ? (
        <button
          type="button"
          aria-label={t('logEntry')}
          title={t('logEntry')}
          disabled={logEntryDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onLogEntryClick()
          }}
          className={cn(
            SHEET_CHROME_BUTTON_CLASS,
            'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] disabled:opacity-60',
          )}
        >
          <FileText className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
