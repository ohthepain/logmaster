import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { DevComponentLabel } from '../../../components/DevComponentLabel'
import { DevTimeTravelPanel } from '../../../components/DevTimeTravelPanel'
import { isDevModeAvailable } from '../../../lib/dev-mode'
import { realNowIso } from '../../../lib/dev-time-travel'
import { resolveInProgressTrip } from '../../../lib/trip-nav'
import { useAppOptionsStore } from '../../../stores/app-options'
import { useLogbookStore } from '../../../stores/logbook'

export const Route = createFileRoute('/_main/dev/time-travel')({
  component: DevTimeTravelPage,
})

function DevTimeTravelPage() {
  const devMode = useAppOptionsStore((state) => state.devMode)
  const devTimeTravelEnabled = useAppOptionsStore(
    (state) => state.devTimeTravelEnabled,
  )
  const setDevTimeTravelEnabled = useAppOptionsStore(
    (state) => state.setDevTimeTravelEnabled,
  )
  const devLogEntryDraftTimeIso = useAppOptionsStore(
    (state) => state.devLogEntryDraftTimeIso,
  )
  const setDevLogEntryDraftTimeIso = useAppOptionsStore(
    (state) => state.setDevLogEntryDraftTimeIso,
  )
  const trips = useLogbookStore((state) => state.trips)
  const inProgressTrip = useMemo(() => resolveInProgressTrip(trips), [trips])

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    if (!devMode || !devTimeTravelEnabled || devLogEntryDraftTimeIso) return
    setDevLogEntryDraftTimeIso(
      inProgressTrip?.startedAt ?? realNowIso(),
    )
  }, [
    devMode,
    devTimeTravelEnabled,
    devLogEntryDraftTimeIso,
    inProgressTrip?.startedAt,
    setDevLogEntryDraftTimeIso,
  ])

  if (!isDevModeAvailable()) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <DevComponentLabel name="DevTimeTravelPage" />
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Dev tools are not available in this environment.
        </p>
      </main>
    )
  }

  const valueIso = devLogEntryDraftTimeIso ?? inProgressTrip?.startedAt ?? realNowIso()

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <DevComponentLabel name="DevTimeTravelPage" />
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="brand-title m-0 text-[2rem] leading-none sm:text-[2.35rem]">
            Time travel
          </h1>
          <p className="m-0 mt-3 text-sm leading-7 text-[var(--sea-ink-soft)]">
            Set the timestamp for the next log entry you create. Real time is
            unchanged everywhere else.
          </p>
        </div>

        {!devMode ? (
          <div className="rounded-[1.25rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              Turn on dev mode from the <span className="font-semibold text-[var(--sea-ink)]">DEV</span> menu in the header to use time travel.
            </p>
          </div>
        ) : (
          <DevTimeTravelPanel
            enabled={devTimeTravelEnabled}
            onEnabledChange={setDevTimeTravelEnabled}
            valueIso={valueIso}
            onChange={setDevLogEntryDraftTimeIso}
            tripStartedAt={inProgressTrip?.startedAt}
          />
        )}

        <Link
          to="/"
          className="inline-flex text-sm font-semibold text-[var(--brand)] no-underline"
        >
          Back home
        </Link>
      </div>
    </main>
  )
}
