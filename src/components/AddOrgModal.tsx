import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import type { Org } from '../domain/org'
import { createOrg } from '../lib/orgs-api'
import { Modal } from './Modal'

type AddOrgModalProps = {
  open: boolean
  onClose: () => void
  onCreated?: (org: Org) => void
}

export function AddOrgModal({ open, onClose, onCreated }: AddOrgModalProps) {
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
      toast.error('Organization name is required')
      return
    }
    setLoading(true)
    try {
      const org = await createOrg(trimmed)
      toast.success(`${org.name} created`)
      setName('')
      onCreated?.(org)
      onClose()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to create organization',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Add organization"
      onClose={handleClose}
      devComponentName="AddOrgModal"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="North Star LLC"
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
            {loading ? 'Creating…' : 'Create'}
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
