import { Check, ImagePlus, Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from './Modal'
import { LOG_ENTRY_TYPES, entryIcon, entryTitle } from '../domain/logbook'
import type { LogEntryType } from '../domain/logbook'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'

type LogEntryComposerModalProps = {
  open: boolean
  tripId: string
  onClose: () => void
  initialType?: LogEntryType
}

export function LogEntryComposerModal({
  open,
  tripId,
  onClose,
  initialType = 'NOTE',
}: LogEntryComposerModalProps) {
  const store = useLogbookStore()
  const [selectedType, setSelectedType] = useState<LogEntryType>(initialType)
  const [draftNote, setDraftNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setDraftNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setSelectedType(initialType)
  }, [open, initialType])

  useEffect(() => {
    if (selectedType !== 'PHOTO') {
      fileInputRef.current?.value && (fileInputRef.current.value = '')
    }
  }, [selectedType])

  if (!open) return null

  const handleAddEntry = async () => {
    const entry = await store.addEntry({
      tripId,
      type: selectedType,
      notes: draftNote,
    })
    if (!entry) return
    toast.success('Saved locally')
    onClose()
  }

  const handlePhotoPick = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Choose a photo first')
      return
    }
    const entry = await store.addEntry({
      tripId,
      type: 'PHOTO',
      notes: draftNote,
      data: { fileName: file.name, size: file.size, mimeType: file.type },
    })
    if (!entry) return
    await store.attachMedia(entry.id, {
      logEntryId: entry.id,
      type: 'photo',
      localPath: file.name,
      remoteUrl: null,
      thumbnailUrl: URL.createObjectURL(file),
    })
    toast.success('Photo saved locally')
    onClose()
  }

  const handleVoicePlaceholder = async () => {
    await store.addEntry({
      tripId,
      type: 'VOICE_NOTE',
      notes: draftNote || 'Voice note placeholder',
      data: { placeholder: true },
    })
    toast.success('Voice note placeholder saved locally')
    onClose()
  }

  return (
    <Modal title="Log Entry" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOG_ENTRY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition',
                selectedType === type
                  ? 'border-[var(--sea-ink)] bg-[var(--active-panel)] text-[var(--sea-ink)]'
                  : 'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
              )}
            >
              <span className="block text-lg">{entryIcon(type)}</span>
              <span className="mt-1 block">{entryTitle(type)}</span>
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Note
          </span>
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            rows={4}
            placeholder="Short note, observation, or reminder"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>

        {selectedType === 'PHOTO' && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)]"
            />
            <p className="m-0 text-xs leading-6 text-[var(--sea-ink-soft)]">
              Photos are stored locally for later sync.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleAddEntry()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Check className="size-4" />
            Save locally
          </button>
          {selectedType === 'PHOTO' && (
            <button
              type="button"
              onClick={() => void handlePhotoPick()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
            >
              <ImagePlus className="size-4" />
              Save photo
            </button>
          )}
          {selectedType === 'VOICE_NOTE' && (
            <button
              type="button"
              onClick={() => void handleVoicePlaceholder()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
            >
              <Mic className="size-4" />
              Save voice placeholder
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
