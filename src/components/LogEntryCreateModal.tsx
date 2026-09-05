import { Link } from '@tanstack/react-router'
import { ArrowLeft, Camera, Check, LocateFixed, Map, Mic, PenLine } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogEntryContentStack, type EntryContentBlock } from './LogEntryContentStack'
import { LogEntryPositionMap } from './LogEntryPositionMap'
import { Modal } from './Modal'
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
import { formatDateTime } from '../lib/logbook-format'
import { readImageFile } from '../lib/image-file'
import { photoMetadataFromLogEntry } from '../lib/photo-exif-stamp'
import {
  stampAndExportPhotoMetadata,
  photoMetadataExportToastMessage,
} from '../lib/photo-metadata-export'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'
import {
  nextContentOrder,
  withNoteOrder,
  withVoiceOrder,
} from '../lib/log-entry-content-order'
import { usePositionPlaceLabel } from '../lib/use-position-place-label'
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
  const [noteOrder, setNoteOrder] = useState<number | null>(null)
  const [voiceOrder, setVoiceOrder] = useState<number | null>(null)
  const [draftPhotoOrder, setDraftPhotoOrder] = useState<number | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null)
  const [voiceRecordingBlob, setVoiceRecordingBlob] = useState<Blob | null>(null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const [draftPosition, setDraftPosition] = useState<MapLngLat | null>(null)
  const [showPositionMap, setShowPositionMap] = useState(false)
  const positionLabel = usePositionPlaceLabel(draftPosition, {
    enabled: step === 'compose',
  })
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
  const showPhotoMetadataAction = devMode && isDevModeAvailable()
  const [metadataBusyKey, setMetadataBusyKey] = useState<string | null>(null)

  const contentOrderInput = useMemo(
    () => ({
      media: [],
      noteOrder: noteEditing || draftNote.trim() ? noteOrder : null,
      voiceOrder:
        isRecordingVoice || voiceRecordingUrl ? voiceOrder : null,
      draftPhotoOrder: photoPreview ? draftPhotoOrder : null,
    }),
    [
      draftNote,
      draftPhotoOrder,
      isRecordingVoice,
      noteEditing,
      noteOrder,
      photoPreview,
      voiceOrder,
      voiceRecordingUrl,
    ],
  )

  const allocateContentOrder = () => nextContentOrder(contentOrderInput)

  const applyDraftPosition = (position: MapLngLat) => {
    setDraftPosition(position)
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
    setNoteOrder(null)
    setVoiceOrder(null)
    setDraftPhotoOrder(null)
    setPhotoFile(null)
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    clearVoiceRecording()
    stopVoiceRecording()
    setDraftPosition(null)
    setShowPositionMap(false)
    positionEditedRef.current = false
    setSaving(false)
    setMetadataBusyKey(null)
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
    if (
      !file ||
      (!file.type.startsWith('image/') && !file.type.startsWith('video/'))
    ) {
      return
    }
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setDraftPhotoOrder(allocateContentOrder())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearPhoto = () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setDraftPhotoOrder(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVoiceToggle = async () => {
    if (isRecordingVoice) {
      stopVoiceRecording()
      return
    }

    if (voiceRecordingUrl) {
      clearVoiceRecording()
      setVoiceOrder(null)
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
        setVoiceOrder((current) => current ?? allocateContentOrder())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecordingVoice(true)
    } catch {
      toast.error('Microphone access is unavailable')
    }
  }

  const openNoteEditor = () => {
    if (noteOrder == null) {
      setNoteOrder(allocateContentOrder())
    }
    setNoteEditing(true)
    requestAnimationFrame(() => noteInputRef.current?.focus())
  }

  const handleSave = async () => {
    if (!selectedType) return
    setSaving(true)
    try {
      const trimmedNote = draftNote.trim()
      const hasPhoto = Boolean(photoFile && photoPreview)
      const hasVoice = Boolean(voiceRecordingBlob && voiceRecordingUrl)
      const mediaOnlyFlow =
        hasPhoto && !hasVoice && (selectedType === 'PHOTO' || !trimmedNote)
      const capturePosition =
        draftPosition?.latitude != null && draftPosition?.longitude != null
          ? {
              latitude: draftPosition.latitude,
              longitude: draftPosition.longitude,
            }
          : null

      const uploadPhotoVideo = async (
        note?: string,
        attachEntryId?: string,
      ) => {
        if (!photoFile || !photoPreview) return
        const isVideo = photoFile.type.startsWith('video/')
        await store.savePhotoVideo(
          {
            tripId,
            fileName: photoFile.name,
            mimeType: photoFile.type,
            size: photoFile.size,
            thumbnailUrl: isVideo ? null : await readImageFile(photoFile),
            remoteUrl: isVideo ? photoPreview : null,
            capturePosition,
            timestamp: showTimeTravel ? entryTimestampIso : undefined,
            note,
            attachEntryId,
            order: draftPhotoOrder ?? undefined,
          },
          { skipSync: true },
        )
      }

      if (mediaOnlyFlow) {
        await uploadPhotoVideo(trimmedNote || undefined)
        await store.syncNow({ skipBootstrap: true })
        toast.success(hasPhoto && photoFile?.type.startsWith('video/') ? 'Video saved' : 'Photo saved')
        if (showTimeTravel) {
          setDevLogEntryDraftTimeIso(advanceIso(entryTimestampIso, HOUR_MS))
        }
        onClose()
        return
      }

      let data: Record<string, unknown> = {}
      if (voiceRecordingBlob) {
        data.voiceNote = true
      }

      data =
        withNoteOrder(
          data,
          trimmedNote ? (noteOrder ?? allocateContentOrder()) : null,
        ) ?? {}
      data =
        withVoiceOrder(
          data,
          voiceRecordingBlob ? (voiceOrder ?? allocateContentOrder()) : null,
        ) ?? {}

      const entry = await store.addEntry(
        {
          tripId,
          type: selectedType,
          notes: trimmedNote || undefined,
          data: Object.keys(data).length > 0 ? data : undefined,
          latitude: draftPosition?.latitude ?? null,
          longitude: draftPosition?.longitude ?? null,
          timestamp: showTimeTravel ? entryTimestampIso : undefined,
        },
        { skipSync: true },
      )
      if (!entry) return

      if (hasPhoto) {
        await uploadPhotoVideo(undefined, entry.id)
      }

      if (voiceRecordingBlob && voiceRecordingUrl) {
        await store.attachMedia(
          entry.id,
          {
            logEntryId: entry.id,
            type: 'voice',
            localPath: 'voice-note.webm',
            remoteUrl: voiceRecordingUrl,
            thumbnailUrl: null,
            order: voiceOrder ?? allocateContentOrder(),
          },
          { skipSync: true },
        )
      }

      await store.syncNow({ skipBootstrap: true })

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
      <Modal title="Log entry" onClose={onClose} showKicker={false} devComponentName="LogEntryCreateModal">
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

  const resolveDraftPhotoTimestamp = () =>
    showTimeTravel ? entryTimestampIso : realNowIso()

  const handleSetDraftPhotoMetadata = async () => {
    if (!photoPreview) return
    setMetadataBusyKey('draft-photo')
    try {
      const input = photoMetadataFromLogEntry({
        entryTimestamp: resolveDraftPhotoTimestamp(),
        entryLatitude: draftPosition?.latitude ?? null,
        entryLongitude: draftPosition?.longitude ?? null,
        draftPosition,
        positionEdited: positionEditedRef.current,
      })
      const { file, dataUrl, exportResult } = await stampAndExportPhotoMetadata(
        photoPreview,
        photoFile?.name ?? 'photo.jpg',
        input,
        photoFile?.name ?? 'photo.jpg',
      )
      if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
      setPhotoFile(file)
      setPhotoPreview(dataUrl)
      toast.success(photoMetadataExportToastMessage(exportResult))
      if (exportResult.exiftoolCommand && !exportResult.exiftoolCopied) {
        toast.message('Exiftool command', {
          description: exportResult.exiftoolCommand,
          duration: 12_000,
        })
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not set photo metadata',
      )
    } finally {
      setMetadataBusyKey(null)
    }
  }

  const contentBlocks: EntryContentBlock[] = []

  if (photoPreview) {
    contentBlocks.push({
      key: 'draft-photo',
      kind: 'photo',
      order: draftPhotoOrder ?? 0,
      src: photoPreview,
      onDelete: clearPhoto,
      onSetMetadata: showPhotoMetadataAction
        ? () => void handleSetDraftPhotoMetadata()
        : undefined,
      metadataBusy: metadataBusyKey === 'draft-photo',
    })
  }

  if (noteEditing) {
    contentBlocks.push({
      key: 'note',
      kind: 'note',
      order: noteOrder ?? 0,
      value: draftNote,
      editing: true,
      onChange: setDraftNote,
      onBlur: () => {
        if (!draftNote.trim()) {
          setNoteEditing(false)
          setNoteOrder(null)
        }
      },
      inputRef: noteInputRef,
    })
  }

  if (voiceRecordingUrl || isRecordingVoice) {
    contentBlocks.push({
      key: 'voice',
      kind: 'voice',
      order: voiceOrder ?? 0,
      src: voiceRecordingUrl,
      recording: isRecordingVoice,
      onRemove: () => {
        clearVoiceRecording()
        stopVoiceRecording()
        setVoiceOrder(null)
      },
    })
  }

  return (
    <Modal
      title={entryTitle(selectedType)}
      onClose={onClose}
      layer="overlay"
      showKicker={false}
      devComponentName="LogEntryCreateModal"
      headerBelow={
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
            accept="image/*,video/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => handlePhotoPick(e.target.files?.[0])}
          />
        </div>
      }
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

        <LogEntryContentStack
          blocks={contentBlocks}
          map={
            <div className="overflow-hidden rounded-[1.25rem] border border-[var(--panel-border)]">
              {showPositionMap ? (
                <LogEntryPositionMap
                  trip={trip}
                  entries={tripEntries}
                  legs={tripLegs}
                  position={draftPosition}
                  onPositionChange={handlePositionChange}
                  initialViewport="current-location"
                />
              ) : null}
              <div
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2',
                  showPositionMap ? 'border-t border-[var(--line)]' : '',
                )}
              >
                <p className="m-0 min-w-0 flex-1 text-xs text-[var(--sea-ink-soft)]">
                  {positionLabel}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPositionMap((value) => !value)}
                    aria-pressed={showPositionMap}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                      showPositionMap
                        ? 'border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]'
                        : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
                    )}
                  >
                    <Map className="size-3" />
                    {showPositionMap ? 'Hide map' : 'Map'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUseGps()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--sea-ink)]"
                  >
                    <LocateFixed className="size-3" />
                    Use GPS
                  </button>
                </div>
              </div>
            </div>
          }
        />

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
