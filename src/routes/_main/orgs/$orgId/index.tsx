import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Sailboat } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AttachBoatToOrgModal } from '../../../../components/AttachBoatToOrgModal'
import { OrgDocumentsTab } from '../../../../components/OrgDocumentsTab'
import { OrgAccountingTab } from '../../../../components/OrgAccountingTab'
import { OrgIconSelector } from '../../../../components/OrgIcon'
import {
  InviteMemberModal,
  ResourceMembersTab,
} from '../../../../components/ResourceMembersTab'
import {
  AddContactModal,
  ORG_CONTACT_AREAS,
  ResourceContactsTab,
} from '../../../../components/ResourceContactsTab'
import type {
  MemberInvite,
  ResourceMember,
} from '../../../../domain/member-invite'
import type {
  ContactResourceArea,
  BoatContactGroup,
} from '../../../../domain/contact'
import type { Org, OrgContact } from '../../../../domain/org'
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
  resendOrgInvite,
  updateOrg,
  updateOrgMemberRole,
} from '../../../../lib/orgs-api'
import { cn } from '../../../../lib/cn'
import { ResourceSectionHeader } from '../../../../components/NotificationBellToggle'
import { useSession } from '../../../../lib/auth-client'

type OrgDetailTab =
  | 'members'
  | 'documents'
  | 'contacts'
  | 'boats'
  | 'accounting'

const ORG_TAB_AREAS: Partial<Record<OrgDetailTab, ContactResourceArea>> = {
  documents: 'DOCUMENTS',
  accounting: 'ACCOUNTING',
}

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
  const [boatContactGroups, setBoatContactGroups] = useState<
    BoatContactGroup[]
  >([])
  const [contactGrants, setContactGrants] = useState<
    ContactResourceArea[] | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [membersRefreshing, setMembersRefreshing] = useState(false)
  const [contactsRefreshing, setContactsRefreshing] = useState(false)
  const [boatsRefreshing, setBoatsRefreshing] = useState(false)
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
      const [orgPayload, membersData, contactsPayload] = await Promise.all([
        fetchOrg(orgId),
        fetchOrgMembers(orgId),
        fetchOrgContacts(orgId),
      ])
      setOrg(orgPayload.org)
      setContactGrants(orgPayload.contactGrants)
      setMembers(membersData.members)
      setPendingInvites(membersData.pendingInvites)
      setContacts(contactsPayload.orgContacts)
      setBoatContactGroups(contactsPayload.boatContacts)
      setNameDraft(orgPayload.org.name)
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

  const refreshMembers = useCallback(async () => {
    setMembersRefreshing(true)
    try {
      const membersData = await fetchOrgMembers(orgId)
      setMembers(membersData.members)
      setPendingInvites(membersData.pendingInvites)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh members')
    } finally {
      setMembersRefreshing(false)
    }
  }, [orgId])

  const refreshContacts = useCallback(async () => {
    setContactsRefreshing(true)
    try {
      const payload = await fetchOrgContacts(orgId)
      setContacts(payload.orgContacts)
      setBoatContactGroups(payload.boatContacts)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh contacts')
    } finally {
      setContactsRefreshing(false)
    }
  }, [orgId])

  const refreshBoats = useCallback(async () => {
    setBoatsRefreshing(true)
    try {
      const orgPayload = await fetchOrg(orgId)
      setOrg(orgPayload.org)
      setContactGrants(orgPayload.contactGrants)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh boats')
    } finally {
      setBoatsRefreshing(false)
    }
  }, [orgId])

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
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Loading organization…
        </p>
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

  const isGuestContact = contactGrants !== null && contactGrants.length > 0
  const tabCandidates: OrgDetailTab[] = isGuestContact
    ? (['documents', 'accounting'] as const).filter((value) => {
        const area = ORG_TAB_AREAS[value]
        return area ? contactGrants.includes(area) : false
      })
    : ['members', 'documents', 'contacts', 'boats', 'accounting']
  const activeTab = tabCandidates.includes(tab)
    ? tab
    : (tabCandidates[0] ?? 'members')
  const tabLabels: Record<OrgDetailTab, string> = {
    members: 'Members',
    documents: 'Documents',
    contacts: 'Contacts',
    boats: 'Boats',
    accounting: 'Accounting',
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
          disabled={!canManageOrg || isGuestContact}
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
              disabled={isGuestContact}
              onClick={() => setEditingName(true)}
              className="brand-title m-0 block min-w-0 text-left text-[2.35rem] leading-none sm:text-[2.75rem] disabled:cursor-default"
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
        {tabCandidates.map((value) => {
          const selected = activeTab === value
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
              {tabLabels[value]}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {activeTab === 'members' ? (
          <ResourceMembersTab
            members={members}
            pendingInvites={pendingInvites}
            memberDetailOrgId={orgId}
            notificationTopic="ORG_MEMBERS"
            notificationOrgId={orgId}
            onRefresh={refreshMembers}
            refreshing={membersRefreshing}
            onInvite={() => setInviteOpen(true)}
            onCreateLink={async () => {
              try {
                const invite = await createOrgInviteLink(orgId)
                setPendingInvites((current) => [invite, ...current])
                await navigator.clipboard.writeText(invite.inviteUrl)
                toast.success('Invite link created and copied')
              } catch (e) {
                toast.error(
                  e instanceof Error
                    ? e.message
                    : 'Failed to create invite link',
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
                !window.confirm(
                  `Remove ${member.user.name} from this organization?`,
                )
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
            onResendInvite={async (invite) => {
              await resendOrgInvite(orgId, invite.id)
            }}
          />
        ) : null}

        {activeTab === 'documents' ? <OrgDocumentsTab orgId={orgId} /> : null}

        {activeTab === 'contacts' ? (
          <ResourceContactsTab
            contacts={contacts}
            boatContactGroups={boatContactGroups}
            canManage={canManageOrg}
            notificationTopic="ORG_CONTACTS"
            notificationOrgId={orgId}
            onRefresh={refreshContacts}
            refreshing={contactsRefreshing}
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
            getContactLink={(contact) => {
              if ('boatId' in contact && typeof contact.boatId === 'string') {
                return {
                  to: '/boats/$boatId/contacts/$contactId',
                  params: {
                    boatId: contact.boatId,
                    contactId: contact.id,
                  },
                }
              }
              return {
                to: '/orgs/$orgId/contacts/$contactId',
                params: { orgId, contactId: contact.id },
              }
            }}
          />
        ) : null}

        {activeTab === 'boats' ? (
          <BoatsTab
            orgId={orgId}
            boats={org.boats ?? []}
            onRefresh={refreshBoats}
            refreshing={boatsRefreshing}
            onAdd={() => setAddBoatOpen(true)}
          />
        ) : null}

        {activeTab === 'accounting' ? (
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
        title="Add org contact"
        devComponentName="AddOrgContactModal"
        grantAreas={ORG_CONTACT_AREAS}
        onSubmit={async (input) => {
          const contact = await createOrgContact(orgId, input)
          setContacts((current) => [...current, contact])
          toast.success('Contact added')
        }}
      />

      <AttachBoatToOrgModal
        open={addBoatOpen}
        onClose={() => setAddBoatOpen(false)}
        orgId={orgId}
        existingBoatIds={(org.boats ?? []).map((boat) => boat.id)}
        onAttached={() => {
          void fetchOrg(orgId).then((payload) => setOrg(payload.org))
        }}
      />
    </main>
  )
}

function BoatsTab({
  orgId,
  boats,
  onAdd,
  onRefresh,
  refreshing = false,
}: {
  orgId: string
  boats: Array<{ id: string; name: string }>
  onAdd: () => void
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}) {
  return (
    <div>
      <ResourceSectionHeader
        title="Boats"
        topic="ORG_BOATS"
        orgId={orgId}
        onRefresh={onRefresh}
        refreshing={refreshing}
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
