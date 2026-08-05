import { Image, Map, Trash2 } from 'lucide-react'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { Modal } from './Modal'
import { cn } from '../lib/cn'

type TripCoverEditModalProps = {
  open: boolean
  busy: boolean
  cover: TripDetailCoverDisplay
  onClose: () => void
  onChoosePhoto: () => void
  onChooseMap: () => void
  onRemoveCover: () => void
}

export function TripCoverEditModal({
  open,
  busy,
  cover,
  onClose,
  onChoosePhoto,
  onChooseMap,
  onRemoveCover,
}: TripCoverEditModalProps) {
  if (!open) return null

  const hasCover = cover.kind !== 'none'

  return (
    <Modal
      title="Trip cover"
      onClose={() => {
        if (!busy) onClose()
      }}
      layer="overlay"
      devComponentName="TripCoverEditModal"
    >
      <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
        Choose a photo, use the trip map, or leave the cover blank.
      </p>

      <div className="mt-4 grid gap-2">
        <CoverOption
          icon={Image}
          title="Photo"
          description="Upload your own image"
          selected={cover.kind === 'photo'}
          disabled={busy}
          onClick={onChoosePhoto}
        />
        <CoverOption
          icon={Map}
          title="Map"
          description="Shows your position while underway, or the route when complete"
          selected={cover.kind === 'map'}
          disabled={busy}
          onClick={onChooseMap}
        />
      </div>

      {hasCover ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRemoveCover}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
        >
          <Trash2 className="size-4" />
          Remove cover
        </button>
      ) : null}
    </Modal>
  )
}

type CoverOptionProps = {
  icon: typeof Image
  title: string
  description: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}

function CoverOption({
  icon: Icon,
  title,
  description,
  selected,
  disabled,
  onClick,
}: CoverOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
        selected
          ? 'border-[var(--brand)] bg-[var(--brand-muted)]'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] hover:bg-[var(--link-bg-hover)]',
        disabled && 'opacity-60',
      )}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--sea-ink)]">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--sea-ink)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--sea-ink-soft)]">
          {description}
        </span>
      </span>
    </button>
  )
}
