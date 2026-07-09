import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, User } from 'lucide-react'
import { toast } from 'sonner'
import type { CrewMember } from '../domain/crew'
import { createCrewMember } from '../lib/crew-api'
import { Modal } from './Modal'

type AddCrewMemberModalProps = {
  open: boolean
  onClose: () => void
  onCreated?: (member: CrewMember) => void
}

export function AddCrewMemberModal({
  open,
  onClose,
  onCreated,
}: AddCrewMemberModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setName('')
    setEmail('')
    setPhoto(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onClose()
  }

  const handlePhotoChange = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    if (!file) {
      setPhoto(null)
      setPhotoPreview(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file')
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Name is required')
      return
    }
    setLoading(true)
    try {
      const { member } = await createCrewMember({
        name: trimmedName,
        email: email.trim() || undefined,
        photo: photo ?? undefined,
      })
      toast.success(
        email.trim()
          ? `Invite sent to ${email.trim()}`
          : `${trimmedName} added to crew`,
      )
      reset()
      onCreated?.(member)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add crew member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add crew member" onClose={handleClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <User className="size-8" strokeWidth={1.75} />
            )}
            <span className="absolute bottom-1 right-1 rounded-full bg-[var(--btn-bg)] p-1 text-[var(--btn-text)]">
              <Camera className="size-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-medium text-[var(--sea-ink)]">
              Photo
            </p>
            <p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
              Optional. Replaced by their profile photo once they accept an
              invite.
            </p>
            {photo && (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-[var(--brand)]"
                onClick={() => handlePhotoChange(null)}
              >
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) =>
              handlePhotoChange(e.target.files?.[0] ?? null)
            }
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
            autoFocus
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Email <span className="font-normal text-[var(--sea-ink-soft)]">(optional)</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            autoComplete="email"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
          <p className="m-0 mt-1.5 text-xs leading-5 text-[var(--sea-ink-soft)]">
            Sends an invite link. When they accept, your placeholder info is
            replaced with their account details.
          </p>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {loading ? 'Saving…' : email.trim() ? 'Add & send invite' : 'Add crew member'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
