import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Mail, Plus, Sailboat, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { AttachBoatToOrgModal } from '../../../../components/AttachBoatToOrgModal'
import { OrgDocumentsTab } from '../../../../components/OrgDocumentsTab'
import { OrgAccountingTab } from '../../../../components/OrgAccountingTab'
import { OrgIconSelector } from '../../../../components/OrgIcon'
import {
  InviteMemberModal,
  ResourceMembersTab,
} from '../../../../components/ResourceMembersTab'
import { Modal } from '../../../../components/Modal'
import type { MemberInvite, ResourceMember } from '../../../../domain/member-invite'
import type {
  Org,
  OrgContact,
  OrgMemberRole,
} from '../../../../domain/org'
import {
  cancelOrgInvite,
  createOrgContact,
  createOrgInviteLink,
  deleteOrgContact,
  fetchOrg,
  fetchOrgContacts,
  fetchOrgMembers,
  inviteOrgMember,
  removeOrgMember,
  updateOrg,
  updateOrgMemberRole,
} from '../../../../lib/orgs-api'
import { cn } from '../../../../lib/cn'
import { ResourceSectionHeader } from '../../../../components/NotificationBellToggle'
import { useSession } from '../../../../lib/auth-client'

type OrgDetailTab = 'members' | 'documents' | 'contacts' | 'boats' | 'accounting'

type OrgDetailSearch = {
  tab?: OrgDetailTab
}

export const Route = createFileRoute('/_main/orgs/$orgId/')({
  validateSearch: (search: Record<string, unknown>): OrgDetailSearch => {
    const tab = search.tab
    if (
      tab === 'members' ||
      tab === 'documents' ||
      tab === 'contacts' ||
      tab === 'boats' ||
      tab === 'accounting'
    ) {
      return { tab }
    }
    return {}
  },
  component: OrgDetailPage,
})

function OrgDetailPage() {
  const { orgId } = Route.useParams()
  const { tab: tabFromSearch } = Route.useSearch()
  const tab = tabFromSearch ?? 'members'
  const navigate = useNavigate()
  const [org, setOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<ResourceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<MemberInvite[]>([])
  const [contacts, setContacts] = useState<OrgContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)
  const [addBoatOpen, setAddBoatOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const session = useSession()
  const currentUserId = session.data?.user?.id
  const canManageOrg = members.some(
    (member) =>
      member.userId === currentUserId &&
      (member.role === 'OWNER' || member.role === 'ADMIN'),
  )
  const canManageAccounting = canManageOrg

  const setTab = useCallback(
    (next: OrgDetailTab) => {
      void navigate({
        to: '/orgs/$orgId',
        params: { orgId },
        search: { tab: next },
      })
    },
    [orgId, navigate],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [orgData, membersData, contactsData] = await Promise.all([
        fetchOrg(orgId),
        fetchOrgMembers(orgId),
        fetchOrgContacts(orgId),
      ])
      setOrg(orgData)
      setMembers(membersData.members)
      setPendingInvites(membersData.pendingInvites)
      setContacts(contactsData)
      setNameDraft(orgData.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load organization')
      setOrg(null)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSaveName = async () => {
    if (!org) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === org.name) {
      setEditingName(false)
      setNameDraft(org.name)
      return
    }
    setSavingName(true)
    try {
      const updated = await updateOrg(org.id, { name: trimmed })
      setOrg(updated)
      setEditingName(false)
      toast.success('Name updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading organization…</p>
      </main>
    )
  }

  if (error || !org) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Organization not found'}
        </p>
        <Link
          to="/orgs"
          className="mt-4 inline-block text-sm text-[var(--sea-ink)]"
        >
          ← Back to orgs
        </Link>
      </main>
    )
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <p className="mb-2 text-sm">
        <Link
          to="/orgs"
          className="text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
        >
          ← Orgs
        </Link>
      </p>

      <div className="flex min-w-0 items-center gap-3">
        <OrgIconSelector
          org={org}
          onOrgChange={setOrg}
          disabled={!canManageOrg}
        />
        <div className="min-w-0 flex-1">
        {editingName ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              className="min-w-[12rem] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 text-[1.35rem] font-semibold text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 sm:text-2xl"
            />
            <button
              type="button"
              disabled={savingName || !nameDraft.trim()}
              onClick={() => void handleSaveName()}
              className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={savingName}
              onClick={() => {
                setEditingName(false)
                setNameDraft(org.name)
              }}
              className="rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="brand-title m-0 block min-w-0 text-left text-[2.35rem] leading-none sm:text-[2.75rem]"
          >
            {org.name}
          </button>
        )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Organization sections"
        className="mt-8 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
      >
        {(
          [
            ['members', 'Members'],
            ['documents', 'Documents'],
            ['contacts', 'Contacts'],
            ['boats', 'Boats'],
            ['accounting', 'Accounting'],
          ] as const
        ).map(([value, label]) => {
          const selected = tab === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(value)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                selected
                  ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === 'members' ? (
          <ResourceMembersTab
            members={members}
            pendingInvites={pendingInvites}
            memberDetailOrgId={orgId}
            notificationTopic="ORG_MEMBERS"
            notificationOrgId={orgId}
            onInvite={() => setInviteOpen(true)}
            onCreateLink={async () => {
              try {
                const invite = await createOrgInviteLink(orgId)
                setPendingInvites((current) => [invite, ...current])
                await navigator.clipboard.writeText(invite.inviteUrl)
                toast.success('Invite link created and copied')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to create invite link',
                )
              }
            }}
            onRoleChange={async (member, role) => {
              try {
                const updated = await updateOrgMemberRole(
                  orgId,
                  member.userId,
                  role,
                )
                setMembers((current) =>
                  current.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                )
                toast.success('Role updated')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to update role',
                )
              }
            }}
            onRemove={async (member) => {
              if (
                !window.confirm(`Remove ${member.user.name} from this organization?`)
              ) {
                return
              }
              try {
                await removeOrgMember(orgId, member.userId)
                setMembers((current) =>
                  current.filter((item) => item.id !== member.id),
                )
                toast.success('Member removed')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to remove member',
                )
              }
            }}
            onCancelInvite={async (invite) => {
              try {
                await cancelOrgInvite(orgId, invite.id)
                setPendingInvites((current) =>
                  current.filter((item) => item.id !== invite.id),
                )
                toast.success('Invite cancelled')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to cancel invite',
                )
              }
            }}
          />
        ) : null}

        {tab === 'documents' ? (
          <OrgDocumentsTab orgId={orgId} />
        ) : null}

        {tab === 'contacts' ? (
          <ContactsTab
            orgId={orgId}
            contacts={contacts}
            onAdd={() => setAddContactOpen(true)}
            onDelete={async (contact) => {
              if (!window.confirm(`Delete contact "${contact.displayName}"?`)) {
                return
              }
              try {
                await deleteOrgContact(orgId, contact.id)
                setContacts((current) =>
                  current.filter((item) => item.id !== contact.id),
                )
                toast.success('Contact deleted')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to delete contact',
                )
              }
            }}
          />
        ) : null}

        {tab === 'boats' ? (
          <BoatsTab
            orgId={orgId}
            boats={org.boats ?? []}
            onAdd={() => setAddBoatOpen(true)}
          />
        ) : null}

        {tab === 'accounting' ? (
          <OrgAccountingTab orgId={orgId} canManage={canManageAccounting} />
        ) : null}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite member"
        onSubmit={async ({ email, role }) => {
          const result = await inviteOrgMember(orgId, { email, role })
          if (result.member) {
            setMembers((current) => [...current, result.member])
            return { kind: 'member' as const, message: `Added ${email}` }
          }
          setPendingInvites((current) => [result.invite, ...current])
          return {
            kind: 'invite' as const,
            message: `Invite sent to ${email}`,
          }
        }}
      />

      <AddContactModal
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        orgId={orgId}
        onCreated={(contact) => {
          setContacts((current) => [...current, contact])
        }}
      />

      <AttachBoatToOrgModal
        open={addBoatOpen}
        onClose={() => setAddBoatOpen(false)}
        orgId={orgId}
        existingBoatIds={(org.boats ?? []).map((boat) => boat.id)}
        onAttached={() => {
          void fetchOrg(orgId).then(setOrg)
        }}
      />

    </main>
  )
}

function BoatsTab({
  orgId,
  boats,
  onAdd,
}: {
  orgId: string
  boats: Array<{ id: string; name: string }>
  onAdd: () => void
}) {
  return (
    <div>
      <ResourceSectionHeader
        title="Boats"
        topic="ORG_BOATS"
        orgId={orgId}
        actions={
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
          >
            <Plus className="size-4" />
            Add boat
          </button>
        }
      />
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
        {boats.length} {boats.length === 1 ? 'boat' : 'boats'}
      </p>

      {boats.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          No boats in this organization yet.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {boats.map((boat) => (
            <li key={boat.id}>
              <Link
                to="/boats/$boatId"
                params={{ boatId: boat.id }}
                className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 no-underline transition hover:bg-[var(--link-bg-hover)]"
              >
                <Sailboat className="size-5 text-[var(--sea-ink-soft)]" />
                <span className="text-sm font-semibold text-[var(--sea-ink)]">
                  {boat.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ContactsTab({
  orgId,
  contacts,
  onAdd,
  onDelete,
}: {
  orgId: string
  contacts: OrgContact[]
  onAdd: () => void
  onDelete: (contact: OrgContact) => void
}) {
  return (
    <div>
      <ResourceSectionHeader
        title="Contacts"
        topic="ORG_CONTACTS"
        orgId={orgId}
        actions={
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
          >
            <Plus className="size-4" />
            Add contact
          </button>
        }
      />
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
        {contacts.length} non-member {contacts.length === 1 ? 'contact' : 'contacts'}
      </p>

      {contacts.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          No non-member contacts yet. Members appear under Members; add contacts
          here for people who are not in the org app.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3"
            >
              <Link
                to="/orgs/$orgId/contacts/$contactId"
                params={{ orgId, contactId: contact.id }}
                className="min-w-0 flex-1 no-underline transition hover:opacity-80"
              >
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                  {contact.displayName}
                </p>
                {contact.email ? (
                  <p className="m-0 mt-1 flex items-center gap-1 text-xs text-[var(--sea-ink-soft)]">
                    <Mail className="size-3.5" />
                    {contact.email}
                  </p>
                ) : null}
                {contact.phone ? (
                  <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                    {contact.phone}
                  </p>
                ) : null}
                {contact.notes ? (
                  <p className="m-0 mt-2 text-xs leading-5 text-[var(--sea-ink-soft)]">
                    {contact.notes}
                  </p>
                ) : null}
              </Link>
              <button
                type="button"
                onClick={() => void onDelete(contact)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddContactModal({
  open,
  onClose,
  orgId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  orgId: string
  onCreated: (contact: OrgContact) => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const reset = () => {
    setDisplayName('')
    setEmail('')
    setPhone('')
    setWhatsapp('')
    setNotes('')
  }

  const handleClose = () => {
    if (loading) return
    reset()
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const name = displayName.trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    setLoading(true)
    try {
      const contact = await createOrgContact(orgId, {
        displayName: name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      toast.success('Contact added')
      onCreated(contact)
      reset()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add contact" onClose={handleClose} devComponentName="AddOrgContactModal">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Name
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Phone
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            WhatsApp
          </span>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {loading ? 'Adding…' : 'Add contact'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleClose}
            className="rounded-full border border-[var(--chip-line)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
