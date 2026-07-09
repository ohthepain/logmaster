import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { createBoat } from '../../../lib/boats-api'

export const Route = createFileRoute('/_main/boats/new')({
  component: NewBoatPage,
})

function NewBoatPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

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
      navigate({ to: '/boats/$boatId', params: { boatId: boat.id } })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create boat')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <h1 className="brand-title m-0 mb-6 text-[2.35rem] leading-none sm:text-[2.75rem]">
        Add boat
      </h1>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-md space-y-4 rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-5"
      >
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
            onClick={() => navigate({ to: '/boats' })}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  )
}
