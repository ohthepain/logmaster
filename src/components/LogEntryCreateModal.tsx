import { Link } from '@tanstack/react-router'
import { ArrowLeft, Camera, Check, LocateFixed, Mic, PenLine, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogEntryPositionMap } from './LogEntryPositionMap'
import { Modal } from './Modal'
import { VoiceNotePlayback } from './VoiceNotePlayback'
import {
  entryIcon,
  entryTitle,
  visibleLogEntryTypes,
} from '../domain/logbook'
import type { LogEntryType } from '../domain/logbook'
import {
  DEV_FALLBACK_POSITION,
  getCurrentPosition,
  subscribeToDevicePosition,
} from '../lib/logbook-context'
import { advanceIso, realNowIso } from '../lib/dev-time-travel'
import { isDevModeAvailable } from '../lib/dev-mode'
import { formatDateTime, formatPosition } from '../lib/logbook-format'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore } from '../stores/logbook'

type LogEntryCreateModalProps = {
  open: boolean
  tripId: string
  onClose: () => void
}

type Step = 'pick-type' | 'compose'

const HOUR_MS = 60 * 60 * 1000

function resolveInitialEntryTimestamp(
  tripStartedAt: string | undefined,
  draftIso: string | null,
): string {
  if (draftIso) return draftIso
  if (tripStartedAt) return tripStartedAt
  return realNowIso()
}

export function LogEntryCreateModal({
  open,
  tripId,
  onClose,
}: LogEntryCreateModalProps) {
  const store = useLogbookStore()
  const trip = store.trips.find((item) => item.id === tripId) ?? null
  const tripEntries = store.entries.filter(
    (entry) => entry.tripId === tripId && !entry.deleted,
  )
  const tripLegs = store.legs.filter((leg) => leg.tripId === tripId)
  const entryTypes = useMemo(
    () => (trip ? visibleLogEntryTypes(trip, tripEntries) : []),
    [trip, tripEntries],
  )
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const positionEditedRef = useRef(false)
  const [step, setStep] = useState<Step>('pick-type')
  const [selectedType, setSelectedType] = useState<LogEntryType | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null)
  const [voiceRecordingBlob, setVoiceRecordingBlob] = useState<Blob | null>(null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const [draftPosition, setDraftPosition] = useState<MapLngLat | null>(null)
  const [positionLabel, setPositionLabel] = useState('Locating…')
  const [saving, setSaving] = useState(false)
  const [entryTimestampIso, setEntryTimestampIso] = useState(realNowIso)
  const devMode = useAppOptionsStore((state) => state.devMode)
  const devTimeTravelEnabled = useAppOptionsStore(
    (state) => state.devTimeTravelEnabled,
  )
  const devLogEntryDraftTimeIso = useAppOptionsStore(
    (state) => state.devLogEntryDraftTimeIso,
  )
  const setDevLogEntryDraftTimeIso = useAppOptionsStore(
    (state) => state.setDevLogEntryDraftTimeIso,
  )
  const showTimeTravel =
    devMode && devTimeTravelEnabled && isDevModeAvailable()

  const applyDraftPosition = (position: MapLngLat) => {
    setDraftPosition(position)
    setPositionLabel(formatPosition(position.latitude, position.longitude))
  }

  const clearVoiceRecording = () => {
    if (voiceRecordingUrl) URL.revokeObjectURL(voiceRecordingUrl)
    setVoiceRecordingUrl(null)
    setVoiceRecordingBlob(null)
  }

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    mediaRecorderRef.current = null
    setIsRecordingVoice(false)
  }

  const reset = () => {
    setStep('pick-type')
    setSelectedType(null)
    setDraftNote('')
    setNoteEditing(false)
    setPhotoFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    clearVoiceRecording()
    stopVoiceRecording()
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
    if (!showTimeTravel) return
    setEntryTimestampIso(
      resolveInitialEntryTimestamp(trip?.startedAt, devLogEntryDraftTimeIso),
    )
  }, [open, showTimeTravel, trip?.startedAt, devLogEntryDraftTimeIso])

  useEffect(() => {
    if (!open || !showTimeTravel) return
    return useAppOptionsStore.subscribe((state) => {
      if (state.devLogEntryDraftTimeIso) {
        setEntryTimestampIso(state.devLogEntryDraftTimeIso)
      }
    })
  }, [open, showTimeTravel])

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

  const handleVoiceToggle = async () => {
    if (isRecordingVoice) {
      stopVoiceRecording()
      return
    }

    if (voiceRecordingUrl) {
      clearVoiceRecording()
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      voiceChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(voiceChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        if (blob.size === 0) return
        clearVoiceRecording()
        setVoiceRecordingBlob(blob)
        setVoiceRecordingUrl(URL.createObjectURL(blob))
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecordingVoice(true)
    } catch {
      toast.error('Microphone access is unavailable')
    }
  }

  const openNoteEditor = () => {
    setNoteEditing(true)
    requestAnimationFrame(() => noteInputRef.current?.focus())
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
      if (voiceRecordingBlob) {
        data.voiceNote = true
      }

      const entry = await store.addEntry({
        tripId,
        type: selectedType,
        notes: draftNote.trim() || undefined,
        data: Object.keys(data).length > 0 ? data : undefined,
        latitude: draftPosition?.latitude ?? null,
        longitude: draftPosition?.longitude ?? null,
        timestamp: showTimeTravel ? entryTimestampIso : undefined,
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

      if (voiceRecordingBlob && voiceRecordingUrl) {
        await store.attachMedia(entry.id, {
          logEntryId: entry.id,
          type: 'voice',
          localPath: 'voice-note.webm',
          remoteUrl: voiceRecordingUrl,
          thumbnailUrl: null,
        })
      }

      toast.success(`${entryTitle(selectedType)} logged`)
      if (showTimeTravel) {
        setDevLogEntryDraftTimeIso(advanceIso(entryTimestampIso, HOUR_MS))
      }
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save log entry',
      )
    } finally {
      setSaving(false)
    }
  }

  const timeTravelNotice = showTimeTravel ? (
    <div className="rounded-2xl border border-dashed border-[var(--brand)]/45 bg-[color-mix(in_oklab,var(--brand-muted)_35%,var(--panel))] px-3 py-2.5 text-xs leading-5 text-[var(--sea-ink-soft)]">
      Entry time:{' '}
      <span className="font-semibold text-[var(--sea-ink)]">
        {formatDateTime(entryTimestampIso)}
      </span>
      {' · '}
      <Link
        to="/dev/time-travel"
        className="font-semibold text-[var(--brand)] no-underline"
        onClick={onClose}
      >
        Edit in time travel
      </Link>
    </div>
  ) : null

  if (step === 'pick-type') {
    return (
      <Modal title="Log entry" onClose={onClose} devComponentName="LogEntryCreateModal">
        <div className="space-y-4">
          {timeTravelNotice}
          {entryTypes.length === 0 ? (
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              No log entry types are available right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {entryTypes.map((type) => (
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
          )}
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
      onClose={onClose}
      layer="overlay"
      devComponentName="LogEntryCreateModal"
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

        {timeTravelNotice}

        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--panel-border)]">
          <LogEntryPositionMap
            trip={trip}
            entries={tripEntries}
            legs={tripLegs}
            position={draftPosition}
            onPositionChange={handlePositionChange}
            initialViewport="current-location"
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

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AttachmentIconButton
              icon={Camera}
              label="Add photo"
              active={!!photoPreview}
              onClick={() => fileInputRef.current?.click()}
            />
            <AttachmentIconButton
              icon={PenLine}
              label="Add note"
              active={noteEditing || draftNote.trim().length > 0}
              onClick={openNoteEditor}
            />
            <AttachmentIconButton
              icon={Mic}
              label={isRecordingVoice ? 'Stop recording' : 'Record voice note'}
              active={isRecordingVoice || !!voiceRecordingUrl}
              recording={isRecordingVoice}
              onClick={() => void handleVoiceToggle()}
            />
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => handlePhotoPick(e.target.files?.[0])}
            />
          </div>

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
          ) : null}

          {noteEditing ? (
            <textarea
              ref={noteInputRef}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onBlur={() => {
                if (!draftNote.trim()) setNoteEditing(false)
              }}
              rows={3}
              placeholder="Add a note…"
              className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
            />
          ) : draftNote.trim() ? (
            <p className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm leading-6 text-[var(--sea-ink)]">
              {draftNote.trim()}
            </p>
          ) : null}

          {voiceRecordingUrl ? (
            <VoiceNotePlayback
              src={voiceRecordingUrl}
              onRemove={() => {
                clearVoiceRecording()
                stopVoiceRecording()
              }}
            />
          ) : isRecordingVoice ? (
            <p className="m-0 text-xs font-medium text-[var(--brand)]">Recording… tap mic to stop</p>
          ) : null}
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

function AttachmentIconButton({
  icon: Icon,
  label,
  active,
  recording = false,
  onClick,
}: {
  icon: typeof Camera
  label: string
  active?: boolean
  recording?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-2xl border transition outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel)]',
        active
          ? recording
            ? 'border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]'
            : 'border-[var(--sea-ink)] bg-[var(--active-panel)] text-[var(--sea-ink)]'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:text-[var(--sea-ink)]',
      )}
    >
      <Icon className={cn('size-5', recording && 'animate-pulse')} strokeWidth={2.1} />
    </button>
  )
}
