import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import type { Boat } from '../domain/boat'
import { createBoat } from '../lib/boats-api'
import { Modal } from './Modal'

type AddBoatModalProps = {
  open: boolean
  onClose: () => void
  onCreated?: (boat: Boat) => void
}

export function AddBoatModal({ open, onClose, onCreated }: AddBoatModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    setName('')
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Boat name is required')
      return
    }
    setLoading(true)
    try {
      const boat = await createBoat(trimmed)
      toast.success(`${boat.name} created`)
      setName('')
      onCreated?.(boat)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create boat')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add boat" onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Boat name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="S/V North Star"
            autoFocus
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create boat'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
