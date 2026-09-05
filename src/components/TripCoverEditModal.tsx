import { Image, Map, Trash2, Camera } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { Modal } from './Modal'
import { cn } from '../lib/cn'

type TripCoverEditModalProps = {
  open: boolean
  busy: boolean
  cover: TripDetailCoverDisplay
  title: string
  subtitle: string
  titlePlaceholder?: string
  onClose: () => void
  onSaveDetails: (input: { title: string; subtitle: string }) => void
  onChoosePhoto: () => void
  onChooseMap: () => void
  onUseCurrentMap: () => void
  onRemoveCover: () => void
  showUseCurrentMap?: boolean
}

export function TripCoverEditModal({
  open,
  busy,
  cover,
  title,
  subtitle,
  titlePlaceholder,
  onClose,
  onSaveDetails,
  onChoosePhoto,
  onChooseMap,
  onUseCurrentMap,
  onRemoveCover,
  showUseCurrentMap = false,
}: TripCoverEditModalProps) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle)

  useEffect(() => {
    if (!open) return
    setDraftTitle(title)
    setDraftSubtitle(subtitle)
  }, [open, title, subtitle])

  if (!open) return null

  const hasCover = cover.kind !== 'none'
  const detailsDirty =
    draftTitle.trim() !== title.trim() || draftSubtitle.trim() !== subtitle.trim()

  const handleClose = () => {
    if (busy) return
    if (detailsDirty) {
      onSaveDetails({
        title: draftTitle.trim(),
        subtitle: draftSubtitle.trim(),
      })
    }
    onClose()
  }

  const saveDetailsIfDirty = () => {
    if (detailsDirty) {
      onSaveDetails({
        title: draftTitle.trim(),
        subtitle: draftSubtitle.trim(),
      })
    }
  }

  const handleCoverAction = (action: () => void) => {
    saveDetailsIfDirty()
    action()
  }

  return (
    <Modal
      title="Edit trip cover"
      onClose={handleClose}
      layer="overlay"
      devComponentName="TripCoverEditModal"
    >
      <div className="grid gap-4">
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
              Title
            </span>
            <input
              type="text"
              value={draftTitle}
              disabled={busy}
              placeholder={titlePlaceholder}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
              Detail
            </span>
            <textarea
              value={draftSubtitle}
              disabled={busy}
              rows={3}
              placeholder="A short description for the trips list"
              onChange={(event) => setDraftSubtitle(event.target.value)}
              className="w-full resize-none rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm leading-6 text-[var(--sea-ink)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
            />
          </label>
          {detailsDirty ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onSaveDetails({
                  title: draftTitle.trim(),
                  subtitle: draftSubtitle.trim(),
                })
              }
              className="justify-self-start rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              Save details
            </button>
          ) : null}
        </div>

        <div>
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
              onClick={() => handleCoverAction(onChoosePhoto)}
            />
            <CoverOption
              icon={Map}
              title="Map"
              description="Shows your position while underway, or the route when complete"
              selected={cover.kind === 'map'}
              disabled={busy}
              onClick={() => handleCoverAction(onChooseMap)}
            />
            {showUseCurrentMap ? (
              <CoverOption
                icon={Camera}
                title="Use current map"
                description="Save what the map is showing now as the trip cover photo"
                selected={false}
                disabled={busy}
                onClick={() => handleCoverAction(onUseCurrentMap)}
              />
            ) : null}
          </div>

          {hasCover ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCoverAction(onRemoveCover)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
            >
              <Trash2 className="size-4" />
              Remove cover
            </button>
          ) : null}
        </div>
      </div>
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
