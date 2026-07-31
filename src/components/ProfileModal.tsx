import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from './Modal'
import { useSession } from '../lib/auth-client'
import {
  deleteProfilePhoto,
  isCustomProfilePhoto,
  profilePhotoUrl,
  updateProfileName,
  uploadProfilePhoto,
} from '../lib/profile-api'
import { cn } from '../lib/cn'

type ProfileModalProps = {
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}

export function ProfileModal({ open, onClose, onUpdated }: ProfileModalProps) {
  const session = useSession()
  const user = session.data?.user
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = useId()
  const [name, setName] = useState('')
  const [photoVersion, setPhotoVersion] = useState(0)
  const [savingName, setSavingName] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)

  useEffect(() => {
    if (!open || !user) return
    setName(user.name || '')
  }, [open, user])

  if (!open || !user) return null

  const photoSrc = profilePhotoUrl(user.image, photoVersion)
  const hasCustomPhoto = isCustomProfilePhoto(user.image)
  const busy = savingName || uploadingPhoto || removingPhoto

  const refreshSession = async () => {
    await session.refetch()
  }

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  const handleSaveName = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name is required')
      return
    }
    if (trimmed === user.name) {
      onClose()
      return
    }
    setSavingName(true)
    try {
      await updateProfileName(trimmed)
      await refreshSession()
      onUpdated?.()
      toast.success('Profile updated')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update profile')
    } finally {
      setSavingName(false)
    }
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file) return
    setUploadingPhoto(true)
    try {
      await uploadProfilePhoto(file)
      setPhotoVersion((value) => value + 1)
      await refreshSession()
      onUpdated?.()
      toast.success('Profile photo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!hasCustomPhoto) return
    setRemovingPhoto(true)
    try {
      await deleteProfilePhoto()
      setPhotoVersion((value) => value + 1)
      await refreshSession()
      onUpdated?.()
      toast.success('Profile photo removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  return (
    <Modal title="Profile" onClose={handleClose} devComponentName="ProfileModal">
      <form onSubmit={(e) => void handleSaveName(e)} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)]">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt=""
                  className="size-full object-cover"
                  width={80}
                  height={80}
                  decoding="async"
                />
              ) : (
                <User className="size-8 text-[var(--sea-ink-soft)]" strokeWidth={1.75} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className={cn(
                'absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--link-bg-hover)]',
                busy && 'opacity-60',
              )}
              aria-label="Upload profile photo"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handlePhotoPick(e.target.files?.[0])}
            />
          </div>

          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
              Profile photo
            </p>
            <p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
              Upload a photo for your account. Stored in the same bucket as boat photos.
            </p>
            {hasCustomPhoto && (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 transition hover:text-red-800 disabled:opacity-60 dark:text-red-300 dark:hover:text-red-200"
              >
                <Trash2 className="size-3.5" />
                {removingPhoto ? 'Removing…' : 'Remove photo'}
              </button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Display name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>

        <p className="m-0 text-xs leading-6 text-[var(--sea-ink-soft)]">
          Signed in as {user.email}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {savingName ? 'Saving…' : 'Save profile'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
