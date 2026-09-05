import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getCurrentPosition } from '../lib/logbook-context'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { isValidMapLngLat } from '../lib/logbook-map-geo'
import { Modal } from './Modal'
import { WaypointPositionEditor } from './WaypointPositionEditor'
import { useLogbookStore } from '../stores/logbook'

type TripWaypointComposerModalProps = {
  open: boolean
  tripId: string
  initialPosition?: MapLngLat | null
  onClose: () => void
}

export function TripWaypointComposerModal({
  open,
  tripId,
  initialPosition = null,
  onClose,
}: TripWaypointComposerModalProps) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [position, setPosition] = useState<MapLngLat | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    setName('')
    setNotes('')
    if (initialPosition && isValidMapLngLat(initialPosition)) {
      setPosition(initialPosition)
      return
    }

    void getCurrentPosition()
      .then((current) => {
        if (current?.latitude != null && current.longitude != null) {
          setPosition({
            latitude: current.latitude,
            longitude: current.longitude,
          })
        }
      })
      .catch(() => {
        setPosition(null)
      })
  }, [open, initialPosition])

  const handleSave = async () => {
    if (!position || !isValidMapLngLat(position)) {
      toast.error('Choose a position on the map')
      return
    }

    setSaving(true)
    try {
      const entry = await useLogbookStore.getState().addTripWaypoint(tripId, {
        latitude: position.latitude,
        longitude: position.longitude,
        name,
        notes,
      })
      if (!entry) {
        throw new Error('Could not save waypoint')
      }
      toast.success('Waypoint added')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save waypoint')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      title="Add waypoint"
      onClose={onClose}
      devComponentName="TripWaypointComposerModal"
    >
      <div className="space-y-4">
        <WaypointPositionEditor position={position} onPositionChange={setPosition} />

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea-ink-soft)]">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional waypoint name"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sea-ink-soft)]">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional notes"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)]"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add waypoint'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
