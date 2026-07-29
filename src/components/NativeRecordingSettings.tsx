import { MapPin } from 'lucide-react'
import { supportsBackgroundGps } from '../lib/platform'
import { useAppOptionsStore } from '../stores/app-options'

export function NativeRecordingSettings({
  tripInProgress,
}: {
  tripInProgress: boolean
}) {
  const backgroundTripRecording = useAppOptionsStore(
    (state) => state.backgroundTripRecording,
  )
  const setBackgroundTripRecording = useAppOptionsStore(
    (state) => state.setBackgroundTripRecording,
  )
  const autoTrackIntervalMinutes = useAppOptionsStore(
    (state) => state.autoTrackIntervalMinutes,
  )
  const setAutoTrackIntervalMinutes = useAppOptionsStore(
    (state) => state.setAutoTrackIntervalMinutes,
  )

  if (!supportsBackgroundGps() || !tripInProgress) {
    return null
  }

  return (
    <section className="island-shell rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-muted)] text-[var(--brand)]">
          <MapPin className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--sea-ink)]">
            Background recording
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--sea-ink-soft)]">
            While this trip is active, logmaster can record GPS in the background
            and add auto-tracked hourly log entries you can edit later.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-3">
        <span className="text-sm font-medium text-[var(--sea-ink)]">
          Record GPS in background
        </span>
        <input
          type="checkbox"
          className="size-4 accent-[var(--brand)]"
          checked={backgroundTripRecording}
          onChange={(event) =>
            setBackgroundTripRecording(event.target.checked)
          }
        />
      </label>

      <label className="mt-3 block text-sm text-[var(--sea-ink-soft)]">
        Minimum interval between auto entries
        <select
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--sea-ink)]"
          value={autoTrackIntervalMinutes}
          disabled={!backgroundTripRecording}
          onChange={(event) =>
            setAutoTrackIntervalMinutes(Number(event.target.value))
          }
        >
          <option value={15}>Every 15 minutes</option>
          <option value={30}>Every 30 minutes</option>
          <option value={60}>Every hour</option>
          <option value={120}>Every 2 hours</option>
        </select>
      </label>
    </section>
  )
}
