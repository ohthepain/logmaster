import { Pause } from 'lucide-react'
import { useAppOptionsStore } from '../stores/app-options'
import { cn } from '../lib/cn'
import { DevComponentLabel } from './DevComponentLabel'

type TripRecordButtonProps = {
  tripId: string
}

export function TripRecordButton({ tripId }: TripRecordButtonProps) {
  const recordingTripId = useAppOptionsStore((state) => state.recordingTripId)
  const setRecordingTripId = useAppOptionsStore((state) => state.setRecordingTripId)
  const recording = recordingTripId === tripId
  const label = recording ? 'Pause recording' : 'Start recording'

  return (
    <div className="relative">
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
          'ios-map-touch-target flex size-9 items-center justify-center rounded-full border backdrop-blur-sm transition',
          recording
            ? 'border-red-300/80 bg-red-600/90 text-white'
            : 'border-white/25 bg-black/30 text-white',
        )}
      >
        {recording ? (
          <Pause className="size-4 fill-current" aria-hidden />
        ) : (
          <span className="size-3.5 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" />
        )}
      </button>
    </div>
  )
}
