import { Check, Plus } from 'lucide-react'
import { Modal } from './Modal'
import { DevComponentLabel } from './DevComponentLabel'
import { CrewAvatar } from './CrewAvatar'
import type { TripCrewUser } from '../domain/connections'
import { cn } from '../lib/cn'

type TripCrewPickerModalProps = {
  open: boolean
  crewMembers: TripCrewUser[]
  selectedIds: string[]
  onClose: () => void
  onChange: (ids: string[]) => void
  requiredIds?: string[]
  stacked?: boolean
}

export function TripCrewPickerModal({
  open,
  crewMembers,
  selectedIds,
  onClose,
  onChange,
  stacked = false,
  requiredIds = [],
}: TripCrewPickerModalProps) {
  if (!open) return null

  const toggle = (memberId: string) => {
    if (requiredIds.includes(memberId)) return
    if (selectedIds.includes(memberId)) {
      onChange(selectedIds.filter((id) => id !== memberId))
      return
    }
    onChange([...selectedIds, memberId])
  }

  return (
    <Modal
      title="Trip crew"
      onClose={onClose}
      layer={stacked ? 'overlay' : 'base'}
      devComponentName="TripCrewPickerModal"
    >
      <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
        Choose crew for this trip. Tap someone with a checkmark to remove them.
      </p>

      {crewMembers.length ? (
        <ul className="mt-4 space-y-2">
          {crewMembers.map((member) => {
            const selected = selectedIds.includes(member.id)
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggle(member.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                    selected
                      ? 'border-green-600/25 bg-green-50 dark:border-green-500/30 dark:bg-green-950/35'
                      : 'border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--chip-bg)]',
                  )}
                >
                  <CrewAvatar
                    name={member.name}
                    imageUrl={member.imageUrl}
                    userId={member.id}
                    className="size-12"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                      {member.name}
                    </p>
                  </div>
                  {selected && (
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
                      <Check className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl bg-[var(--panel)] px-4 py-8 text-center">
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Connect with a registered user or invite someone to your boat before
            selecting crew.
          </p>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

type TripCrewSectionProps = {
  crewMembers: TripCrewUser[]
  selectedIds: string[]
  onAddClick: () => void
}

export function TripCrewSection({
  crewMembers,
  selectedIds,
  onAddClick,
}: TripCrewSectionProps) {
  const selected = crewMembers.filter((member) =>
    selectedIds.includes(member.id),
  )

  return (
    <div>
      <DevComponentLabel name="TripCrewSection" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--sea-ink)]">Crew</span>
        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] transition hover:text-[var(--brand-hover)]"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Add crew
        </button>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((member) => (
            <div key={member.id} title={member.name}>
              <CrewAvatar
                name={member.name}
                imageUrl={member.imageUrl}
                userId={member.id}
                className="size-11"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
          No crew added yet.
        </p>
      )}
    </div>
  )
}
