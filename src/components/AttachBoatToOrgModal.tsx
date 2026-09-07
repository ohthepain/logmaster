import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchBoats } from '../lib/boats-api'
import { attachBoatToOrg } from '../lib/orgs-api'
import { Modal } from './Modal'

type AttachBoatToOrgModalProps = {
  open: boolean
  onClose: () => void
  orgId: string
  existingBoatIds: string[]
  onAttached: () => void
}

export function AttachBoatToOrgModal({
  open,
  onClose,
  orgId,
  existingBoatIds,
  onAttached,
}: AttachBoatToOrgModalProps) {
  const [boats, setBoats] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void fetchBoats()
      .then((all) => {
        const existing = new Set(existingBoatIds)
        setBoats(
          all
            .filter((boat) => !existing.has(boat.id))
            .map((boat) => ({ id: boat.id, name: boat.name })),
        )
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load boats')
        setBoats([])
      })
      .finally(() => setLoading(false))
  }, [open, existingBoatIds])

  if (!open) return null

  const handleAttach = async (boatId: string) => {
    setAttachingId(boatId)
    try {
      await attachBoatToOrg(orgId, boatId)
      toast.success('Boat added')
      onAttached()
      setBoats((current) => current.filter((item) => item.id !== boatId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add boat')
    } finally {
      setAttachingId(null)
    }
  }

  return (
    <Modal title="Add boat" onClose={onClose} devComponentName="AttachBoatToOrgModal">
      {loading ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading boats…</p>
      ) : boats.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          No eligible boats. You need owner or admin access on a boat that is not
          already in this organization.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {boats.map((boat) => (
            <li
              key={boat.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3"
            >
              <span className="text-sm font-semibold text-[var(--sea-ink)]">
                {boat.name}
              </span>
              <button
                type="button"
                disabled={attachingId === boat.id}
                onClick={() => void handleAttach(boat.id)}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {attachingId === boat.id ? 'Adding…' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
