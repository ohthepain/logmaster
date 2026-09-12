import { Copy, Link2, Mail, Trash2, UserPlus, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { MemberInvite, ResourceMember } from '../domain/member-invite'
import { MEMBER_ROLE_LABELS } from '../domain/member-invite'
import type { OrgMemberRole } from '../domain/org'
import { CrewAvatar } from './CrewAvatar'
import { Modal } from './Modal'
import { profilePhotoUrl } from '../lib/profile-api'
import { cn } from '../lib/cn'
import {
  NotificationBellToggle,
  ResourceRefreshButton,
} from './NotificationBellToggle'
import type { NotificationTopic } from '../domain/notifications'

type InviteMemberModalProps = {
  open: boolean
  onClose: () => void
  title: string
  onSubmit: (input: {
    email: string
    role: OrgMemberRole
  }) => Promise<{ kind: 'member' | 'invite'; message: string }>
}

export function InviteMemberModal({
  open,
  onClose,
  title,
  onSubmit,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgMemberRole>('MEMBER')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleClose = () => {
    if (loading) return
    setEmail('')
    setRole('MEMBER')
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast.error('Email is required')
      return
    }
    setLoading(true)
    try {
      const result = await onSubmit({ email: trimmed, role })
      toast.success(result.message)
      handleClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to invite member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={handleClose}
      devComponentName="InviteMemberModal"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="crew@example.com"
            autoFocus
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Role
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrgMemberRole)}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          >
            {Object.entries(MEMBER_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="m-0 text-xs leading-5 text-[var(--sea-ink-soft)]">
          If they don&apos;t have an account yet, we&apos;ll email them a link
          to sign up and join automatically.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type ResourceMembersTabProps = {
  members: ResourceMember[]
  pendingInvites: MemberInvite[]
  canManageMembers?: boolean
  memberDetailOrgId?: string
  notificationTopic?: NotificationTopic
  notificationBoatId?: string
  notificationOrgId?: string
  onInvite: () => void
  onCreateLink: () => void
  onRoleChange: (member: ResourceMember, role: OrgMemberRole) => void
  onRemove: (member: ResourceMember) => void
  onCancelInvite: (invite: MemberInvite) => void
  onResendInvite?: (invite: MemberInvite) => Promise<void>
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

async function copyInviteUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Invite link copied')
  } catch {
    toast.error('Could not copy link')
  }
}

export function ResourceMembersTab({
  members,
  pendingInvites,
  canManageMembers = true,
  memberDetailOrgId,
  notificationTopic,
  notificationBoatId,
  notificationOrgId,
  onInvite,
  onCreateLink,
  onRoleChange,
  onRemove,
  onCancelInvite,
  onResendInvite,
  onRefresh,
  refreshing = false,
}: ResourceMembersTabProps) {
  const navigate = useNavigate()
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(
    null,
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            {members.length} {members.length === 1 ? 'member' : 'members'}
            {pendingInvites.length > 0
              ? ` · ${pendingInvites.length} pending`
              : ''}
          </p>
          {notificationTopic ? (
            <NotificationBellToggle
              topic={notificationTopic}
              boatId={notificationBoatId}
              orgId={notificationOrgId}
            />
          ) : null}
        </div>
        {canManageMembers || onRefresh ? (
          <div className="flex flex-wrap items-center gap-3">
            {canManageMembers ? (
              <>
                <button
                  type="button"
                  onClick={onCreateLink}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
                >
                  <Link2 className="size-4" />
                  Invite link
                </button>
                <button
                  type="button"
                  onClick={onInvite}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
                >
                  <UserPlus className="size-4" />
                  Invite
                </button>
              </>
            ) : null}
            {onRefresh ? (
              <ResourceRefreshButton
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!canManageMembers ? (
        <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
          Only the boat owner or an admin can invite and manage members.
        </p>
      ) : null}

      {members.length === 0 && pendingInvites.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">No members yet.</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {members.map((member) => {
            const profile = (
              <>
                <CrewAvatar
                  name={member.user.name}
                  imageUrl={profilePhotoUrl(member.user.image)}
                  className="size-11"
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                    {member.user.name}
                    {member.isOwner ? (
                      <span className="ml-2 text-xs font-medium text-[var(--sea-ink-soft)]">
                        Owner
                      </span>
                    ) : null}
                  </p>
                  <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">
                    {member.user.email}
                  </p>
                </div>
              </>
            )

            return (
              <li
                key={member.id}
                role={memberDetailOrgId ? 'button' : undefined}
                tabIndex={memberDetailOrgId ? 0 : undefined}
                onClick={
                  memberDetailOrgId && member.contactId
                    ? () => {
                        void navigate({
                          to: '/orgs/$orgId/contacts/$contactId',
                          params: {
                            orgId: memberDetailOrgId,
                            contactId: member.contactId!,
                          },
                        })
                      }
                    : undefined
                }
                onKeyDown={
                  memberDetailOrgId && member.contactId
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          void navigate({
                            to: '/orgs/$orgId/contacts/$contactId',
                            params: {
                              orgId: memberDetailOrgId,
                              contactId: member.contactId!,
                            },
                          })
                        }
                      }
                    : undefined
                }
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3',
                  memberDetailOrgId &&
                    member.contactId &&
                    'cursor-pointer transition hover:bg-[var(--link-bg-hover)]',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {profile}
                </div>
                {member.isOwner || !canManageMembers ? (
                  <span className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                    {MEMBER_ROLE_LABELS[member.role]}
                  </span>
                ) : (
                  <>
                    <select
                      value={member.role}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(e) =>
                        onRoleChange(member, e.target.value as OrgMemberRole)
                      }
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]"
                    >
                      {Object.entries(MEMBER_ROLE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void onRemove(member)
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  </>
                )}
              </li>
            )
          })}
          {pendingInvites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]">
                  <Mail className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                    {invite.inviteeEmail ?? 'Invite link'}
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                      Pending
                    </span>
                  </p>
                  <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">
                    {MEMBER_ROLE_LABELS[invite.role]} · expires{' '}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {canManageMembers ? (
                <>
                  {invite.inviteeEmail && onResendInvite ? (
                    <button
                      type="button"
                      disabled={resendingInviteId === invite.id}
                      onClick={() => {
                        setResendingInviteId(invite.id)
                        void onResendInvite(invite)
                          .then(() => toast.success('Invite resent'))
                          .catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Failed to resend invite',
                            ),
                          )
                          .finally(() => setResendingInviteId(null))
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] disabled:opacity-60"
                    >
                      <Mail className="size-3.5" />
                      {resendingInviteId === invite.id
                        ? 'Sending…'
                        : 'Resend invite'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void copyInviteUrl(invite.inviteUrl)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)]"
                  >
                    <Copy className="size-3.5" />
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCancelInvite(invite)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                </>
              ) : (
                <span className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                  {MEMBER_ROLE_LABELS[invite.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
