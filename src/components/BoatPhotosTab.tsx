import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Boat, BoatPhoto } from '../domain/boat'
import {
  deleteBoatPhoto,
  updateBoatPhoto,
  uploadBoatPhoto,
} from '../lib/boats-api'
import { cn } from '../lib/cn'
import { ResourceSectionHeader } from './NotificationBellToggle'

type BoatPhotosTabProps = {
  boat: Boat
  onBoatChange: (boat: Boat) => void
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function BoatPhotosTab({
  boat,
  onBoatChange,
  onRefresh,
  refreshing = false,
}: BoatPhotosTabProps) {
  const [uploading, setUploading] = useState(false)
  const [activePhoto, setActivePhoto] = useState<BoatPhoto | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const photo = await uploadBoatPhoto(boat.id, file)
      onBoatChange({
        ...boat,
        photos: [...boat.photos, photo].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      })
      toast.success('Photo uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openPhotoMenu = (photo: BoatPhoto) => {
    setActivePhoto(photo)
    setCaptionDraft(photo.caption ?? '')
  }

  const handleSetDefault = async () => {
    if (!activePhoto) return
    try {
      const updated = await updateBoatPhoto(activePhoto.id, { isDefault: true })
      onBoatChange({
        ...boat,
        photos: boat.photos.map((photo) =>
          photo.id === updated.id ? updated : { ...photo, isDefault: false },
        ),
      })
      setActivePhoto(updated)
      toast.success('Default photo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update photo')
    }
  }

  const handleSaveCaption = async () => {
    if (!activePhoto) return
    try {
      const updated = await updateBoatPhoto(activePhoto.id, {
        caption: captionDraft,
      })
      onBoatChange({
        ...boat,
        photos: boat.photos.map((photo) =>
          photo.id === updated.id ? updated : photo,
        ),
      })
      setActivePhoto(updated)
      toast.success('Caption saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save caption')
    }
  }

  const handleDeletePhoto = async () => {
    if (!activePhoto) return
    if (!window.confirm('Delete this photo?')) return
    try {
      await deleteBoatPhoto(activePhoto.id)
      onBoatChange({
        ...boat,
        photos: boat.photos.filter((photo) => photo.id !== activePhoto.id),
      })
      setActivePhoto(null)
      toast.success('Photo deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo')
    }
  }

  return (
    <>
      <ResourceSectionHeader
        title="Photos"
        topic="BOAT_PHOTOS"
        boatId={boat.id}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          <ImagePlus className="size-4" />
          {uploading ? 'Uploading…' : 'Add photos'}
        </button>
      </div>

      {boat.photos.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
          No photos yet. Add one to show it here.
        </p>
      ) : (
        <div className="mt-6 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex snap-x snap-mandatory gap-3 pb-2">
            {boat.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => openPhotoMenu(photo)}
                className={cn(
                  'relative shrink-0 snap-start overflow-hidden rounded-2xl border bg-[var(--panel)]',
                  photo.isDefault
                    ? 'border-[var(--active-border)] ring-2 ring-[var(--sea-ink)]/15'
                    : 'border-[var(--panel-border)]',
                )}
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.caption ?? boat.name}
                  className="h-48 w-64 object-cover sm:h-56 sm:w-72"
                />
                {photo.isDefault && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--btn-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--btn-text)]">
                    <Star className="size-3" />
                    Default
                  </span>
                )}
                {photo.caption && (
                  <span className="absolute inset-x-0 bottom-0 bg-[var(--overlay)] px-3 py-2 text-left text-xs text-white">
                    {photo.caption}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePhoto && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[var(--overlay)] p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="island-kicker">Photo</p>
                <h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">
                  {boat.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)]"
              >
                Close
              </button>
            </div>

            <img
              src={activePhoto.imageUrl}
              alt={activePhoto.caption ?? boat.name}
              className="mb-4 max-h-64 w-full rounded-2xl object-cover"
            />

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Caption
              </span>
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={3}
                placeholder="Optional caption"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveCaption()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
              >
                Save caption
              </button>
              {!activePhoto.isDefault && (
                <button
                  type="button"
                  onClick={() => void handleSetDefault()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                >
                  <Star className="size-4" />
                  Set as default
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeletePhoto()}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
              >
                <Trash2 className="size-4" />
                Delete photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
