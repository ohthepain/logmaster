import {
  Camera,
  Edit3,
  Trash2,
} from 'lucide-react'
import { useId, useRef } from 'react'
import type { ComponentType } from 'react'
import { entryIcon, entryTitle } from '../domain/logbook'
import type { LogEntry, Media } from '../domain/logbook'
import {
  formatDateTime,
  formatPosition,
  formatWeather,
} from '../lib/logbook-format'
import { cn } from '../lib/cn'

type LogEntryCardProps = {
  entry: LogEntry
  media: Media[]
  onEdit: () => void
  onDelete: () => void
  editing: boolean
  editingNote: string
  onEditingNoteChange: (next: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onAddPhoto?: (file: File) => void
}

export function LogEntryCard({
  entry,
  media,
  onEdit,
  onDelete,
  editing,
  editingNote,
  onEditingNoteChange,
  onSaveEdit,
  onCancelEdit,
  onAddPhoto,
}: LogEntryCardProps) {
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoPick = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/') || !onAddPhoto) return
    onAddPhoto(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <article
      className={cn(
        'rounded-[1.5rem] border p-4 shadow-sm',
        entry.deleted
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-[var(--panel-border)] bg-[var(--surface-strong)]',
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] text-xl">
          {entryIcon(entry.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                {entryTitle(entry.type)}
              </p>
              <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                {formatDateTime(entry.timestamp)}
                {entry.accuracy != null
                  ? ` · ±${Math.round(entry.accuracy)}m`
                  : ''}
              </p>
            </div>
            <SyncBadge synced={entry.synced} deleted={entry.deleted} />
          </div>

          <div className="mt-2 space-y-2 text-sm text-[var(--sea-ink)]">
            <p className="m-0">{formatPosition(entry.latitude, entry.longitude)}</p>
            {entry.heading != null && (
              <p className="m-0">Heading {Math.round(entry.heading)}°</p>
            )}
            {entry.notes && !editing && <p className="m-0">{entry.notes}</p>}
            {entry.weather && (
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Weather: {formatWeather(entry.weather)}
              </p>
            )}
            {media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {media.map((item) => (
                  <EntryBadge key={item.id}>
                    {item.type}
                    {item.localPath ? ` · ${item.localPath}` : ''}
                  </EntryBadge>
                ))}
              </div>
            )}
            {media.some((item) => item.thumbnailUrl) && (
              <div className="flex flex-wrap gap-2">
                {media
                  .filter((item) => item.thumbnailUrl)
                  .map((item) => (
                    <img
                      key={item.id}
                      src={item.thumbnailUrl ?? undefined}
                      alt=""
                      className="size-20 rounded-xl border border-[var(--line)] object-cover"
                    />
                  ))}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editingNote}
                onChange={(e) => onEditingNoteChange(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="rounded-full bg-[var(--btn-bg)] px-3 py-2 text-xs font-semibold text-[var(--btn-text)]"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <IconButton icon={Edit3} label="Edit" onClick={onEdit} />
              {onAddPhoto && (
                <>
                  <IconButton
                    icon={Camera}
                    label="Add photo"
                    onClick={() => fileInputRef.current?.click()}
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
                </>
              )}
              <IconButton icon={Trash2} label="Delete" onClick={onDelete} danger />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition',
        danger
          ? 'border-red-500/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:text-red-300'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function SyncBadge({ synced, deleted }: { synced: boolean; deleted: boolean }) {
  if (!deleted && synced) return null

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]',
        deleted
          ? 'bg-red-500/10 text-red-700 dark:text-red-300'
          : 'border border-[var(--line)] bg-[var(--panel)] text-[var(--sea-ink)]',
      )}
    >
      {deleted ? 'Deleted' : 'Not synced'}
    </span>
  )
}

function EntryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)]">
      {children}
    </span>
  )
}
