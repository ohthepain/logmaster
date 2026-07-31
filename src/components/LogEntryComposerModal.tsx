import { ArrowLeft, Camera, Check, LocateFixed, Mic, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogEntryPositionMap } from './LogEntryPositionMap'
import { Modal } from './Modal'
import { LOG_ENTRY_TYPES, entryIcon, entryTitle } from '../domain/logbook'
import type { LogEntryType } from '../domain/logbook'
import {
  DEV_FALLBACK_POSITION,
  getCurrentPosition,
  subscribeToDevicePosition,
} from '../lib/logbook-context'
import { formatPosition } from '../lib/logbook-format'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'

type LogEntryComposerModalProps = {
  open: boolean
  tripId: string
  onClose: () => void
  initialType?: LogEntryType
}

type Step = 'pick-type' | 'compose'

export function LogEntryComposerModal({
  open,
  tripId,
  onClose,
  initialType,
}: LogEntryComposerModalProps) {
  const store = useLogbookStore()
  const trip = store.trips.find((item) => item.id === tripId) ?? null
  const tripEntries = store.entries.filter(
    (entry) => entry.tripId === tripId && !entry.deleted,
  )
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const positionEditedRef = useRef(false)
  const [step, setStep] = useState<Step>('pick-type')
  const [selectedType, setSelectedType] = useState<LogEntryType | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [includeVoiceNote, setIncludeVoiceNote] = useState(false)
  const [draftPosition, setDraftPosition] = useState<MapLngLat | null>(null)
  const [positionLabel, setPositionLabel] = useState('Locating…')
  const [saving, setSaving] = useState(false)

  const applyDraftPosition = (position: MapLngLat) => {
    setDraftPosition(position)
    setPositionLabel(formatPosition(position.latitude, position.longitude))
  }

  const reset = () => {
    setStep('pick-type')
    setSelectedType(null)
    setDraftNote('')
    setPhotoFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setIncludeVoiceNote(false)
    setDraftPosition(null)
    positionEditedRef.current = false
    setPositionLabel('Locating…')
    setSaving(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (initialType) {
      setSelectedType(initialType)
      setStep('compose')
    }
  }, [open, initialType])

  useEffect(() => {
    if (!open || step !== 'compose') return

    return subscribeToDevicePosition((position) => {
      if (positionEditedRef.current) return
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
    })
  }, [open, step, tripId])

  if (!open) return null

  const pickType = (type: LogEntryType) => {
    setSelectedType(type)
    setStep('compose')
  }

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
    if (!selectedType) return
    setSaving(true)
    try {
      const data: Record<string, unknown> = {}
      if (photoFile) {
        data.fileName = photoFile.name
        data.size = photoFile.size
        data.mimeType = photoFile.type
      }
      if (includeVoiceNote) {
        data.voiceNote = true
        data.placeholder = true
      }

      const entry = await store.addEntry({
        tripId,
        type: selectedType,
        notes: draftNote.trim() || undefined,
        data: Object.keys(data).length > 0 ? data : undefined,
        latitude: draftPosition?.latitude ?? null,
        longitude: draftPosition?.longitude ?? null,
      })
      if (!entry) return

      if (photoFile) {
        await store.attachMedia(entry.id, {
          logEntryId: entry.id,
          type: 'photo',
          localPath: photoFile.name,
          remoteUrl: null,
          thumbnailUrl: URL.createObjectURL(photoFile),
        })
      }

      toast.success(`${entryTitle(selectedType)} logged`)
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save log entry',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  if (step === 'pick-type') {
    return (
      <Modal title="Log entry" onClose={handleClose} devComponentName="LogEntryComposerModal">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOG_ENTRY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => pickType(type)}
              className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-3 text-left text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
            >
              <span className="block text-lg">{entryIcon(type)}</span>
              <span className="mt-1 block">{entryTitle(type)}</span>
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  if (!selectedType || !trip) return null

  const handlePositionChange = (position: MapLngLat) => {
    positionEditedRef.current = true
    applyDraftPosition(position)
  }

  const handleUseGps = async () => {
    positionEditedRef.current = false
    const position = await getCurrentPosition({ force: true })
    if (position.latitude == null || position.longitude == null) {
      toast.error('Could not get current location')
      return
    }
    applyDraftPosition({
      longitude: position.longitude,
      latitude: position.latitude,
    })
  }

  return (
    <Modal
      title={entryTitle(selectedType)}
      onClose={handleClose}
      layer="overlay"
      devComponentName="LogEntryComposerModal"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep('pick-type')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]"
        >
          <ArrowLeft className="size-4" />
          Change type
        </button>

        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--panel-border)]">
          <LogEntryPositionMap
            trip={trip}
            entries={tripEntries}
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
                Take photo
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
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          <Check className="size-4" />
          {saving ? 'Saving…' : `Save ${entryTitle(selectedType)}`}
        </button>
      </div>
    </Modal>
  )
}
