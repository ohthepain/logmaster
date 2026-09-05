import { Camera, LocateFixed, Mic, PenLine, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LogEntryContentStack, type EntryContentBlock } from './LogEntryContentStack'
import { LogEntryPositionMap } from './LogEntryPositionMap'
import { Modal } from './Modal'
import { entryTitle } from '../domain/logbook'
import {
  DEV_FALLBACK_POSITION,
  getCurrentPosition,
} from '../lib/logbook-context'
import type { MapLngLat } from '../lib/logbook-map-geo'
import { cn } from '../lib/cn'
import {
  nextContentOrder,
  readNoteOrder,
  readVoiceOrder,
  withNoteOrder,
  withVoiceOrder,
} from '../lib/log-entry-content-order'
import { readImageFile } from '../lib/image-file'
import { isDevModeAvailable } from '../lib/dev-mode'
import { photoMetadataFromLogEntry } from '../lib/photo-exif-stamp'
import {
  stampAndExportPhotoMetadata,
  photoMetadataExportToastMessage,
} from '../lib/photo-metadata-export'
import {
  seedPlaceFromEntryData,
  usePositionPlaceLabel,
} from '../lib/use-position-place-label'
import { useAppOptionsStore } from '../stores/app-options'
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
  const devMode = useAppOptionsStore((state) => state.devMode)
  const showPhotoMetadataAction = devMode && isDevModeAvailable()
  const trip = store.trips.find((item) => item.id === tripId) ?? null
  const entry = entryId
    ? store.entries.find((item) => item.id === entryId) ?? null
    : null
  const tripEntries = store.entries.filter(
    (item) => item.tripId === tripId && !item.deleted,
  )
  const tripLegs = store.legs.filter((leg) => leg.tripId === tripId)
  const tripTracks = store.tracks.filter((track) => track.tripId === tripId)
  const entryMedia = entryId
    ? store.media.filter((item) => item.logEntryId === entryId)
    : []
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const positionEditedRef = useRef(false)
  const [draftNote, setDraftNote] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteOrder, setNoteOrder] = useState<number | null>(null)
  const [voiceOrder, setVoiceOrder] = useState<number | null>(null)
  const [draftPhotoOrder, setDraftPhotoOrder] = useState<number | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [includeVoiceNote, setIncludeVoiceNote] = useState(false)
  const [draftPosition, setDraftPosition] = useState<MapLngLat | null>(null)
  const [seedPlace, setSeedPlace] = useState(() =>
    entry ? seedPlaceFromEntryData(entry.data) : null,
  )
  const positionLabel = usePositionPlaceLabel(draftPosition, {
    seedPlace,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [metadataBusyKey, setMetadataBusyKey] = useState<string | null>(null)

  const applyDraftPosition = (position: MapLngLat) => {
    setDraftPosition(position)
    setSeedPlace(null)
  }

  const reset = () => {
    setDraftNote('')
    setNoteEditing(false)
    setNoteOrder(null)
    setVoiceOrder(null)
    setDraftPhotoOrder(null)
    setPhotoFile(null)
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    setIncludeVoiceNote(false)
    setDraftPosition(null)
    setSeedPlace(null)
    positionEditedRef.current = false
    setSaving(false)
    setDeleting(false)
    setMetadataBusyKey(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (!entry) return

    const notes = entry.notes ?? ''
    setDraftNote(notes)
    setNoteEditing(notes.trim().length > 0)
    setNoteOrder(readNoteOrder(entry.data))
    setVoiceOrder(readVoiceOrder(entry.data))
    setIncludeVoiceNote(
      entry.data?.voiceNote === true || entry.data?.placeholder === true,
    )
    positionEditedRef.current = false

    if (entry.latitude != null && entry.longitude != null) {
      const place = seedPlaceFromEntryData(entry.data)
      setSeedPlace(place)
      setDraftPosition({
        latitude: entry.latitude,
        longitude: entry.longitude,
      })
      return
    }

    setSeedPlace(null)
    setDraftPosition(null)
  }, [open, entry?.id, entry?.latitude, entry?.longitude, entry?.notes, entry?.data])

  const contentOrderInput = useMemo(
    () => ({
      media: entryMedia,
      noteOrder: noteEditing || draftNote.trim() ? noteOrder : null,
      voiceOrder: includeVoiceNote ? voiceOrder : null,
      draftPhotoOrder: photoPreview ? draftPhotoOrder : null,
    }),
    [
      draftNote,
      draftPhotoOrder,
      entryMedia,
      includeVoiceNote,
      noteEditing,
      noteOrder,
      photoPreview,
      voiceOrder,
    ],
  )

  const isEntryDirty = (): boolean => {
    if (!entry) return false
    if (photoFile && photoPreview) return true

    const trimmedNote = draftNote.trim()
    const savedNote = (entry.notes ?? '').trim()
    if (trimmedNote !== savedNote) return true

    const savedVoice =
      entry.data?.voiceNote === true || entry.data?.placeholder === true
    if (includeVoiceNote !== savedVoice) return true

    const nextNoteOrder = trimmedNote
      ? (noteOrder ?? readNoteOrder(entry.data))
      : null
    if (nextNoteOrder !== readNoteOrder(entry.data)) return true

    const nextVoiceOrder = includeVoiceNote
      ? (voiceOrder ?? readVoiceOrder(entry.data))
      : null
    if (nextVoiceOrder !== readVoiceOrder(entry.data)) return true

    const entryLat = entry.latitude ?? null
    const entryLng = entry.longitude ?? null
    const draftLat = draftPosition?.latitude ?? null
    const draftLng = draftPosition?.longitude ?? null
    if (entryLat !== draftLat || entryLng !== draftLng) return true

    return false
  }

  if (!open || !entry || !trip) return null

  const allocateContentOrder = () => nextContentOrder(contentOrderInput)

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

  const handlePersist = async (options?: { sync?: boolean }) => {
    let data = { ...(entry.data ?? {}) }
    if (includeVoiceNote) {
      data.voiceNote = true
      data.placeholder = true
    } else {
      delete data.voiceNote
      delete data.placeholder
    }

    const trimmedNote = draftNote.trim()
    data = withVoiceOrder(
      data,
      includeVoiceNote ? (voiceOrder ?? allocateContentOrder()) : null,
    ) ?? {}
    data =
      withNoteOrder(
        data,
        trimmedNote ? (noteOrder ?? allocateContentOrder()) : null,
      ) ?? {}

    if (photoFile && photoPreview) {
      const isVideo = photoFile.type.startsWith('video/')
      const capturePosition =
        draftPosition?.latitude != null && draftPosition?.longitude != null
          ? {
              latitude: draftPosition.latitude,
              longitude: draftPosition.longitude,
            }
          : null
      await store.savePhotoVideo(
        {
          tripId,
          fileName: photoFile.name,
          mimeType: photoFile.type,
          size: photoFile.size,
          thumbnailUrl: isVideo ? null : await readImageFile(photoFile),
          remoteUrl: isVideo ? photoPreview : null,
          capturePosition,
          timestamp: entry.timestamp,
          attachEntryId: entry.id,
          order: draftPhotoOrder ?? allocateContentOrder(),
        },
        { skipSync: true },
      )
    }

    await store.updateEntry(
      entry.id,
      {
        notes: trimmedNote || null,
        latitude: draftPosition?.latitude ?? null,
        longitude: draftPosition?.longitude ?? null,
        data: Object.keys(data).length > 0 ? data : null,
      },
      { skipSync: true },
    )

    if (options?.sync !== false) {
      await store.syncNow({ skipBootstrap: true })
    }
  }

  const handleClose = async () => {
    if (deleting || saving) return
    if (!isEntryDirty()) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await handlePersist({ sync: false })
      onClose()
      void store.syncNow({ skipBootstrap: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update log entry',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (deleting || saving) return
    onClose()
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

  const openNoteEditor = () => {
    if (noteOrder == null) {
      setNoteOrder(allocateContentOrder())
    }
    setNoteEditing(true)
    requestAnimationFrame(() => noteInputRef.current?.focus())
  }

  const handleRemoveMedia = async (mediaId: string) => {
    const item = entryMedia.find((candidate) => candidate.id === mediaId)
    if (item?.thumbnailUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(item.thumbnailUrl)
    }
    try {
      await store.removeMedia(mediaId)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove photo',
      )
    }
  }

  const toggleVoiceNote = () => {
    setIncludeVoiceNote((current) => {
      const next = !current
      if (next && voiceOrder == null) {
        setVoiceOrder(allocateContentOrder())
      }
      return next
    })
  }

  const handleSetPhotoMetadata = async (
    key: string,
    src: string,
    fileName: string,
    options?: { mediaId?: string },
  ) => {
    setMetadataBusyKey(key)
    try {
      const input = photoMetadataFromLogEntry({
        entryTimestamp: entry.timestamp,
        entryLatitude: entry.latitude,
        entryLongitude: entry.longitude,
        draftPosition,
        positionEdited: positionEditedRef.current,
      })
      const { file, dataUrl, exportResult } = await stampAndExportPhotoMetadata(
        src,
        fileName,
        input,
        fileName,
      )
      if (options?.mediaId) {
        await store.updateMedia(options.mediaId, {
          thumbnailUrl: dataUrl,
          localPath: file.name,
        })
      } else {
        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
        setPhotoFile(file)
        setPhotoPreview(dataUrl)
      }
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

  for (const item of entryMedia) {
    if (!item.thumbnailUrl) continue
    contentBlocks.push({
      key: item.id,
      kind: 'photo',
      order: item.order,
      src: item.thumbnailUrl,
      onDelete: () => void handleRemoveMedia(item.id),
      onSetMetadata: showPhotoMetadataAction
        ? () =>
            void handleSetPhotoMetadata(item.id, item.thumbnailUrl!, item.localPath ?? 'photo.jpg', {
              mediaId: item.id,
            })
        : undefined,
      metadataBusy: metadataBusyKey === item.id,
    })
  }

  if (photoPreview) {
    contentBlocks.push({
      key: 'draft-photo',
      kind: 'photo',
      order: draftPhotoOrder ?? 0,
      src: photoPreview,
      onDelete: clearPhoto,
      onSetMetadata: showPhotoMetadataAction
        ? () =>
            void handleSetPhotoMetadata(
              'draft-photo',
              photoPreview,
              photoFile?.name ?? 'photo.jpg',
            )
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

  if (includeVoiceNote) {
    contentBlocks.push({
      key: 'voice',
      kind: 'voice',
      order: voiceOrder ?? 0,
    })
  }

  const attachmentToolbar = (
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
        label={includeVoiceNote ? 'Remove voice note' : 'Add voice note'}
        active={includeVoiceNote}
        onClick={toggleVoiceNote}
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
  )

  return (
    <Modal
      title={entryTitle(entry.type)}
      onClose={() => void handleClose()}
      layer="overlay"
      showKicker={false}
      devComponentName="LogEntryComposerModal"
      headerBelow={attachmentToolbar}
      headerActions={
        <>
          <button
            type="button"
            disabled={saving || deleting}
            onClick={handleCancel}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => void handleDelete()}
            aria-label={deleting ? 'Deleting entry' : 'Delete entry'}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
          >
            <Trash2 className="size-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>
      }
    >
      <LogEntryContentStack
        blocks={contentBlocks}
        map={
          <div className="overflow-hidden rounded-[1.25rem] border border-[var(--panel-border)]">
            <LogEntryPositionMap
              trip={trip}
              entries={mapEntries}
              legs={tripLegs}
              tracks={tripTracks}
              position={draftPosition}
              onPositionChange={handlePositionChange}
              initialViewport="entry-focus"
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
        }
      />
    </Modal>
  )
}

function AttachmentIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Camera
  label: string
  active?: boolean
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
          ? 'border-[var(--sea-ink)] bg-[var(--active-panel)] text-[var(--sea-ink)]'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:text-[var(--sea-ink)]',
      )}
    >
      <Icon className="size-5" strokeWidth={2.1} />
    </button>
  )
}
