import { useState } from 'react'
import { toast } from 'sonner'
import { applyTripCoverPhoto } from '../lib/trip-cover-photo'

export function SetTripCoverButton({
  tripId,
  source,
}: {
  tripId: string
  source: () => Promise<Blob | string>
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  async function apply() {
    if (state === 'saving') return
    setState('saving')
    try {
      await applyTripCoverPhoto(tripId, await source())
      setState('saved')
      toast.success('Trip cover updated')
      window.setTimeout(() => {
        setState((current) => (current === 'saved' ? 'idle' : current))
      }, 2000)
    } catch (error) {
      setState('idle')
      toast.error(
        error instanceof Error ? error.message : 'Could not set the trip cover',
      )
    }
  }

  const label =
    state === 'saving'
      ? 'Setting…'
      : state === 'saved'
        ? 'Cover set'
        : 'Set as cover'

  return (
    <button
      type="button"
      aria-label="Set as trip cover photo"
      disabled={state === 'saving'}
      onClick={(event) => {
        event.stopPropagation()
        void apply()
      }}
      className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)] shadow-sm disabled:opacity-60"
    >
      {label}
    </button>
  )
}
