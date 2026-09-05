import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { RouteWaypoint } from '../domain/route'
import { getCurrentPosition } from '../lib/logbook-context'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { isValidMapLngLat } from '../lib/logbook-map-geo'
import { Modal } from './Modal'
import { WaypointPositionEditor } from './WaypointPositionEditor'
import { useRoutesStore } from '../stores/routes'

type RouteWaypointComposerModalProps = {
  open: boolean
  routeId: string
  waypoint: RouteWaypoint | null
  initialPosition?: MapLngLat | null
  onClose: () => void
  onSaved?: (waypoint: RouteWaypoint) => void
}

export function RouteWaypointComposerModal({
  open,
  routeId,
  waypoint,
  initialPosition = null,
  onClose,
  onSaved,
}: RouteWaypointComposerModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [position, setPosition] = useState<MapLngLat | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    if (waypoint) {
      setName(waypoint.name ?? '')
      setDescription(waypoint.description ?? '')
      setPosition({
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
      })
      return
    }

    setName('')
    setDescription('')
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
  }, [open, waypoint, initialPosition])

  const handleSave = async () => {
    if (!position || !isValidMapLngLat(position)) {
      toast.error('Choose a position on the map')
      return
    }

    setSaving(true)
    try {
      const store = useRoutesStore.getState()
      const saved = waypoint
        ? await store.updateRouteWaypoint(waypoint.id, {
            latitude: position.latitude,
            longitude: position.longitude,
            name,
            description,
          })
        : await store.addRouteWaypoint(routeId, {
            latitude: position.latitude,
            longitude: position.longitude,
            name,
            description,
          })

      if (!saved) {
        throw new Error('Could not save waypoint')
      }

      toast.success(waypoint ? 'Waypoint updated' : 'Waypoint added')
      onSaved?.(saved)
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
      title={waypoint ? 'Edit waypoint' : 'Add waypoint'}
      onClose={onClose}
      devComponentName="RouteWaypointComposerModal"
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
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional notes about this waypoint"
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
            {saving ? 'Saving…' : waypoint ? 'Save changes' : 'Add waypoint'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
