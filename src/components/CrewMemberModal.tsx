import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Camera, Mail, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from './Modal'
import { CrewAvatar } from './CrewAvatar'
import type { CrewMember } from '../domain/crew'
import {
  deleteCrewMember,
  deleteCrewMemberPhoto,
  resendCrewInvite,
  updateCrewMember,
  uploadCrewMemberPhoto,
} from '../lib/crew-api'
import { cn } from '../lib/cn'

type CrewMemberModalProps = {
  member: CrewMember | null
  open: boolean
  onClose: () => void
  onUpdated?: () => void
  onDeleted?: () => void
}

function memberStatusLabel(member: CrewMember): string {
  if (member.isFriend) return 'Friend'
  if (member.isLinked) return 'Connected'
  if (member.pendingInvite) return 'Invite pending'
  return 'Local'
}

function memberPhotoSrc(member: CrewMember, cacheBust: number): string | null {
  if (!member.imageUrl) return null
  if (
    cacheBust &&
    (member.imageUrl.includes('/api/crew/members/') ||
      member.imageUrl.includes('/api/crew/users/'))
  ) {
    return `${member.imageUrl}?v=${cacheBust}`
  }
  return member.imageUrl
}

export function CrewMemberModal({
  member,
  open,
  onClose,
  onUpdated,
  onDeleted,
}: CrewMemberModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [photoVersion, setPhotoVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [resending, setResending] = useState(false)
  const [removing, setRemoving] = useState(false)

  const editable = member ? !member.isLinked : false
  const busy = saving || uploadingPhoto || removingPhoto || resending || removing

  useEffect(() => {
    if (!open || !member) return
    setName(member.name)
    setEmail(member.pendingInvite?.inviteeEmail ?? member.email ?? '')
    setPhotoVersion(0)
  }, [open, member])

  if (!open || !member) return null

  const photoSrc = memberPhotoSrc(member, photoVersion)
  const hasCustomPhoto = editable && Boolean(member.imageUrl)
  const statusLabel = memberStatusLabel(member)

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!editable) {
      onClose()
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Name is required')
      return
    }

    const trimmedEmail = email.trim()
    const currentEmail = member.pendingInvite?.inviteeEmail ?? member.email ?? ''
    const nameChanged = trimmedName !== member.name
    const emailChanged = trimmedEmail !== currentEmail

    if (!nameChanged && !emailChanged) {
      onClose()
      return
    }

    setSaving(true)
    try {
      await updateCrewMember(member.id, {
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(emailChanged ? { email: trimmedEmail || null } : {}),
      })
      onUpdated?.()
      toast.success('Crew member updated')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update crew member')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file || !editable) return
    setUploadingPhoto(true)
    try {
      await uploadCrewMemberPhoto(member.id, file)
      setPhotoVersion((value) => value + 1)
      onUpdated?.()
      toast.success('Photo updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!editable || !hasCustomPhoto) return
    setRemovingPhoto(true)
    try {
      await deleteCrewMemberPhoto(member.id)
      setPhotoVersion((value) => value + 1)
      onUpdated?.()
      toast.success('Photo removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  const handleResend = async () => {
    if (!member.pendingInvite) return
    setResending(true)
    try {
      await resendCrewInvite(member.pendingInvite.id)
      onUpdated?.()
      toast.success('Invite resent')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resend invite')
    } finally {
      setResending(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!window.confirm(`Remove ${member.name} from your crew?`)) return
    setRemoving(true)
    try {
      await deleteCrewMember(member.id)
      onDeleted?.()
      toast.success('Crew member removed')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove crew member')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Modal title="Crew member" onClose={handleClose}>
      <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <CrewAvatar
              name={member.name}
              imageUrl={photoSrc}
              className="size-20"
            />
            {editable && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className={cn(
                    'absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--link-bg-hover)]',
                    busy && 'opacity-60',
                  )}
                  aria-label="Upload crew member photo"
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
              </>
            )}
          </div>

          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--kicker)]">
              {statusLabel}
            </p>
            {editable ? (
              <>
                <p className="m-0 mt-2 text-sm font-semibold text-[var(--sea-ink)]">
                  Photo
                </p>
                <p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
                  Add a photo for this crew member on your roster.
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
              </>
            ) : (
              <p className="m-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
                Profile details come from their logmaster account.
              </p>
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crew member name"
            readOnly={!editable}
            autoFocus={editable}
            className={cn(
              'w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20',
              !editable && 'cursor-default opacity-80',
            )}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={editable ? 'Optional — sends an invite' : ''}
            type="email"
            readOnly={!editable}
            className={cn(
              'w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20',
              !editable && 'cursor-default opacity-80',
            )}
          />
          {editable && (
            <p className="m-0 mt-1.5 text-xs leading-5 text-[var(--sea-ink-soft)]">
              Add or change an email to send a crew invite.
            </p>
          )}
        </label>

        {member.pendingInvite && (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-[var(--sea-ink)]">
                  <Mail className="size-4 shrink-0" />
                  Invite pending
                </p>
                <p className="m-0 mt-1 truncate text-xs text-[var(--sea-ink-soft)]">
                  Sent to {member.pendingInvite.inviteeEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={busy}
                className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend invite'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {editable ? (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            {editable ? 'Cancel' : 'Close'}
          </button>
          <button
            type="button"
            onClick={() => void handleRemoveMember()}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:text-red-800 disabled:opacity-60 dark:text-red-300 dark:hover:text-red-200"
          >
            <Trash2 className="size-4" />
            {removing ? 'Removing…' : 'Remove from crew'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
