import { Camera, Check, LocateFixed, Mic, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogEntryPositionMap } from './LogEntryPositionMap'
import { Modal } from './Modal'
import { entryTitle } from '../domain/logbook'
import type { Media } from '../domain/logbook'
import {
  DEV_FALLBACK_POSITION,
  getCurrentPosition,
} from '../lib/logbook-context'
import { formatPosition } from '../lib/logbook-format'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'

type LogEntryComposerModalProps = {
  open: boolean
  tripId: string
  entryId: string | null
  onClose: () => void
}

export function LogEntryComposerModal({
  open,
  tripId,
  entryId,
  onClose,
}: LogEntryComposerModalProps) {
  const store = useLogbookStore()
  const trip = store.trips.find((item) => item.id === tripId) ?? null
  const entry = entryId
    ? store.entries.find((item) => item.id === entryId) ?? null
    : null
  const tripEntries = store.entries.filter(
    (item) => item.tripId === tripId && !item.deleted,
  )
  const entryMedia = entryId
    ? store.media.filter((item) => item.logEntryId === entryId)
    : []
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const positionEditedRef = useRef(false)
  const [draftNote, setDraftNote] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [includeVoiceNote, setIncludeVoiceNote] = useState(false)
  const [draftPosition, setDraftPosition] = useState<MapLngLat | null>(null)
  const [positionLabel, setPositionLabel] = useState('Locating…')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const applyDraftPosition = (position: MapLngLat) => {
    setDraftPosition(position)
    setPositionLabel(formatPosition(position.latitude, position.longitude))
  }

  const reset = () => {
    setDraftNote('')
    setPhotoFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setIncludeVoiceNote(false)
    setDraftPosition(null)
    positionEditedRef.current = false
    setPositionLabel('Locating…')
    setSaving(false)
    setDeleting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (!entry) return

    setDraftNote(entry.notes ?? '')
    setIncludeVoiceNote(
      entry.data?.voiceNote === true || entry.data?.placeholder === true,
    )
    positionEditedRef.current = false

    if (entry.latitude != null && entry.longitude != null) {
      applyDraftPosition({
        latitude: entry.latitude,
        longitude: entry.longitude,
      })
      return
    }

    setDraftPosition(null)
    setPositionLabel('Position unavailable')
  }, [open, entry?.id, entry?.latitude, entry?.longitude, entry?.notes, entry?.data])

  if (!open || !entry || !trip) return null

  const handlePhotoPick = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = { ...(entry.data ?? {}) }
      if (includeVoiceNote) {
        data.voiceNote = true
        data.placeholder = true
      } else {
        delete data.voiceNote
        delete data.placeholder
      }

      await store.updateEntry(entry.id, {
        notes: draftNote.trim() || null,
        latitude: draftPosition?.latitude ?? null,
        longitude: draftPosition?.longitude ?? null,
        data: Object.keys(data).length > 0 ? data : null,
      })

      if (photoFile) {
        await store.attachMedia(entry.id, {
          logEntryId: entry.id,
          type: 'photo',
          localPath: photoFile.name,
          remoteUrl: null,
          thumbnailUrl: URL.createObjectURL(photoFile),
        })
      }

      toast.success('Log entry updated')
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update log entry',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await store.deleteEntry(entry.id)
      toast.success('Log entry deleted')
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete log entry',
      )
    } finally {
      setDeleting(false)
    }
  }

  const handlePositionChange = (position: MapLngLat) => {
    positionEditedRef.current = true
    applyDraftPosition(position)
  }

  const handleUseGps = async () => {
    positionEditedRef.current = false
    const position = await getCurrentPosition({ force: true })
    if (position.latitude == null || position.longitude == null) {
      applyDraftPosition({
        longitude: DEV_FALLBACK_POSITION.longitude,
        latitude: DEV_FALLBACK_POSITION.latitude,
      })
      return
    }
    applyDraftPosition({
      longitude: position.longitude,
      latitude: position.latitude,
    })
  }

  const mapEntries = tripEntries.filter((item) => item.id !== entry.id)

  return (
    <Modal
      title={entryTitle(entry.type)}
      onClose={onClose}
      layer="overlay"
      devComponentName="LogEntryComposerModal"
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--panel-border)]">
          <LogEntryPositionMap
            trip={trip}
            entries={mapEntries}
            position={draftPosition}
            onPositionChange={handlePositionChange}
          />
          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2">
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{positionLabel}</p>
            <button
              type="button"
              onClick={() => void handleUseGps()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--sea-ink)]"
            >
              <LocateFixed className="size-3" />
              Use GPS
            </button>
          </div>
        </div>

        <ExistingMedia media={entryMedia} />

        <div className="space-y-2">
          <p className="m-0 text-sm font-medium text-[var(--sea-ink)]">Photo</p>
          {photoPreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-[var(--panel-border)]">
              <img
                src={photoPreview}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Remove photo"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
              >
                <Camera className="size-4" />
                Add photo
              </button>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => handlePhotoPick(e.target.files?.[0])}
              />
            </>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Note
          </span>
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            rows={3}
            placeholder="Optional note"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>

        <div className="space-y-2">
          <p className="m-0 text-sm font-medium text-[var(--sea-ink)]">
            Voice note
          </p>
          <button
            type="button"
            onClick={() => setIncludeVoiceNote((current) => !current)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
              includeVoiceNote
                ? 'border-[var(--sea-ink)] bg-[var(--active-panel)] text-[var(--sea-ink)]'
                : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
            )}
          >
            <Mic className="size-4" />
            {includeVoiceNote ? 'Voice note included' : 'Add voice note'}
          </button>
          {includeVoiceNote && (
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
              Recording will be added in a future update. This entry is marked
              for a voice note.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => void handleSave()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          <Check className="size-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => void handleDelete()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
        >
          <Trash2 className="size-4" />
          {deleting ? 'Deleting…' : 'Delete entry'}
        </button>
      </div>
    </Modal>
  )
}

function ExistingMedia({ media }: { media: Media[] }) {
  const photos = media.filter((item) => item.thumbnailUrl)
  if (photos.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="m-0 text-sm font-medium text-[var(--sea-ink)]">Photos</p>
      <div className="flex flex-wrap gap-2">
        {photos.map((item) => (
          <img
            key={item.id}
            src={item.thumbnailUrl ?? undefined}
            alt=""
            className="size-24 rounded-xl border border-[var(--line)] object-cover"
          />
        ))}
      </div>
    </div>
  )
}
