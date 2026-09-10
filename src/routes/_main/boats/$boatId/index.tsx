import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BoatDocumentsTab } from '../../../../components/BoatDocumentsTab'
import { BoatPhotosTab } from '../../../../components/BoatPhotosTab'
import { BoatSharesTab } from '../../../../components/BoatSharesTab'
import { BoatAssetsTab } from '../../../../components/BoatAssetsTab'
import { BoatAccountingTab } from '../../../../components/BoatAccountingTab'
import { BoatIconSelector } from '../../../../components/BoatIconSelector'
import {
  InviteMemberModal,
  ResourceMembersTab,
} from '../../../../components/ResourceMembersTab'
import {
  AddContactModal,
  BOAT_CONTACT_AREAS,
  ResourceContactsTab,
} from '../../../../components/ResourceContactsTab'
import type { BoatContact } from '../../../../domain/contact'
import type { ContactResourceArea } from '../../../../domain/contact'
import type { Boat } from '../../../../domain/boat'
import type { MemberInvite, ResourceMember  } from '../../../../domain/member-invite'
import type { OrgMemberRole } from '../../../../domain/org'
import {
  cancelBoatInvite,
  createBoatInviteLink,
  fetchBoat,
  fetchBoatMembers,
  inviteBoatMember,
  removeBoatMember,
  resendBoatInvite,
  updateBoat,
  updateBoatMemberRole,
} from '../../../../lib/boats-api'
import {
  createBoatContact,
  deleteBoatContact,
  fetchBoatContacts,
} from '../../../../lib/boat-contacts-api'
import type { BoatIconId } from '../../../../lib/boat-icons'
import { isBoatIconId } from '../../../../lib/boat-icons'
import { cn } from '../../../../lib/cn'
import { NotificationBellToggle } from '../../../../components/NotificationBellToggle'

type BoatDetailTab =
  | 'photos'
  | 'documents'
  | 'assets'
  | 'accounting'
  | 'members'
  | 'shares'
  | 'contacts'

const BOAT_TAB_AREAS: Partial<Record<BoatDetailTab, ContactResourceArea>> = {
  photos: 'PHOTOS',
  documents: 'DOCUMENTS',
  assets: 'ASSETS',
  accounting: 'ACCOUNTING',
}

type BoatDetailSearch = {
  tab?: BoatDetailTab
}

export const Route = createFileRoute('/_main/boats/$boatId/')({
  validateSearch: (search: Record<string, unknown>): BoatDetailSearch => {
    const tab = search.tab
    if (
      tab === 'photos' ||
      tab === 'documents' ||
      tab === 'assets' ||
      tab === 'accounting' ||
      tab === 'members' ||
      tab === 'shares' ||
      tab === 'contacts'
    ) {
      return { tab }
    }
    return {}
  },
  component: BoatDetailPage,
})

function BoatDetailPage() {
  const { boatId } = Route.useParams()
  const { tab: tabFromSearch } = Route.useSearch()
  const navigate = useNavigate()
  const [boat, setBoat] = useState<Boat | null>(null)
  const [members, setMembers] = useState<ResourceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<MemberInvite[]>([])
  const [canManageMembers, setCanManageMembers] = useState(false)
  const [contacts, setContacts] = useState<BoatContact[]>([])
  const [contactGrants, setContactGrants] = useState<ContactResourceArea[] | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [membersRefreshing, setMembersRefreshing] = useState(false)
  const [contactsRefreshing, setContactsRefreshing] = useState(false)
  const [photosRefreshing, setPhotosRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingIcon, setSavingIcon] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)

  const setTab = useCallback(
    (next: BoatDetailTab) => {
      void navigate({
        to: '/boats/$boatId',
        params: { boatId },
        search: { tab: next },
      })
    },
    [boatId, navigate],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [boatData, membersData, contactsData] = await Promise.all([
        fetchBoat(boatId),
        fetchBoatMembers(boatId),
        fetchBoatContacts(boatId),
      ])
      setBoat(boatData.boat)
      setContactGrants(boatData.contactGrants)
      setMembers(membersData.members)
      setPendingInvites(membersData.pendingInvites)
      setCanManageMembers(membersData.canManageMembers)
      setContacts(contactsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boat')
      setBoat(null)
    } finally {
      setLoading(false)
    }
  }, [boatId])

  useEffect(() => {
    void load()
  }, [load])

  const refreshMembers = useCallback(async () => {
    setMembersRefreshing(true)
    try {
      const membersData = await fetchBoatMembers(boatId)
      setMembers(membersData.members)
      setPendingInvites(membersData.pendingInvites)
      setCanManageMembers(membersData.canManageMembers)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh members')
    } finally {
      setMembersRefreshing(false)
    }
  }, [boatId])

  const refreshContacts = useCallback(async () => {
    setContactsRefreshing(true)
    try {
      setContacts(await fetchBoatContacts(boatId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh contacts')
    } finally {
      setContactsRefreshing(false)
    }
  }, [boatId])

  const refreshPhotos = useCallback(async () => {
    setPhotosRefreshing(true)
    try {
      const boatData = await fetchBoat(boatId)
      setBoat(boatData.boat)
      setContactGrants(boatData.contactGrants)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to refresh photos')
    } finally {
      setPhotosRefreshing(false)
    }
  }, [boatId])

  const handleIconChange = async (nextIconId: BoatIconId) => {
    if (!boat || boat.iconId === nextIconId) return
    setSavingIcon(true)
    try {
      const updated = await updateBoat(boat.id, { iconId: nextIconId })
      setBoat(updated)
      toast.success('Map icon updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update icon')
    } finally {
      setSavingIcon(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading boat…</p>
      </main>
    )
  }

  if (error || !boat) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Boat not found'}
        </p>
        <Link
          to="/boats"
          className="mt-4 inline-block text-sm text-[var(--sea-ink)]"
        >
          ← Back to boats
        </Link>
      </main>
    )
  }

  const tabRaw = tabFromSearch ?? 'photos'
  const isGuestContact = contactGrants !== null && contactGrants.length > 0
  const tabCandidates: BoatDetailTab[] = isGuestContact
    ? (['photos', 'documents', 'assets', 'accounting'] as const).filter(
        (value) => {
          const area = BOAT_TAB_AREAS[value]
          return area ? contactGrants.includes(area) : false
        },
      )
    : [
        'photos',
        'documents',
        'assets',
        'accounting',
        ...(boat.orgId ? (['shares'] as const) : []),
        'contacts',
        'members',
      ]
  const tab: BoatDetailTab = tabCandidates.includes(tabRaw as BoatDetailTab)
    ? (tabRaw as BoatDetailTab)
    : tabCandidates[0] ?? 'photos'
  const tabLabels: Record<BoatDetailTab, string> = {
    photos: 'Photos',
    documents: 'Documents',
    assets: 'Assets',
    accounting: 'Accounting',
    shares: 'Shares',
    contacts: 'Contacts',
    members: 'Members',
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <p className="mb-2 text-sm">
        <Link
          to="/boats"
          className="text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
        >
          ← Boats
        </Link>
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BoatIconSelector
            variant="icon"
            value={isBoatIconId(boat.iconId) ? boat.iconId : 'medium'}
            onChange={(iconId) => void handleIconChange(iconId)}
            disabled={savingIcon}
          />
          <h1 className="brand-title m-0 min-w-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            {boat.name}
          </h1>
        </div>
        {boat.orgId && boat.orgName ? (
          <Link
            to="/orgs/$orgId"
            params={{ orgId: boat.orgId }}
            search={{ tab: 'boats' }}
            className="mt-1 inline-flex shrink-0 items-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-[var(--link-bg-hover)] sm:mt-2"
          >
            Org: {boat.orgName}
          </Link>
        ) : null}
        <NotificationBellToggle
          topic="BOAT_TRIPS_COMPLETED"
          boatId={boat.id}
          label="Completed trips"
          className="mt-1 sm:mt-2"
        />
      </div>

      <div
        role="tablist"
        aria-label="Boat sections"
        className="mt-8 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
      >
        {tabCandidates.map((value) => {
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
              {tabLabels[value]}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === 'photos' ? (
          <BoatPhotosTab
            boat={boat}
            onBoatChange={setBoat}
            onRefresh={refreshPhotos}
            refreshing={photosRefreshing}
          />
        ) : null}
        {tab === 'documents' ? (
          <BoatDocumentsTab boatId={boat.id} />
        ) : null}
        {tab === 'assets' ? (
          <BoatAssetsTab
            boatId={boat.id}
            boatName={boat.name}
            orgName={boat.orgName}
            members={members}
          />
        ) : null}
        {tab === 'accounting' ? (
          <BoatAccountingTab boatId={boat.id} orgId={boat.orgId} />
        ) : null}
        {tab === 'shares' && boat.orgId ? (
          <BoatSharesTab boatId={boat.id} />
        ) : null}
        {tab === 'contacts' ? (
          <ResourceContactsTab
            contacts={contacts}
            canManage={canManageMembers}
            notificationTopic="BOAT_CONTACTS"
            notificationBoatId={boatId}
            onRefresh={refreshContacts}
            refreshing={contactsRefreshing}
            onAdd={() => setAddContactOpen(true)}
            onDelete={async (contact) => {
              if (!window.confirm(`Delete contact "${contact.displayName}"?`)) {
                return
              }
              try {
                await deleteBoatContact(boatId, contact.id)
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
            getContactLink={(contact) => ({
              to: '/boats/$boatId/contacts/$contactId',
              params: { boatId, contactId: contact.id },
            })}
          />
        ) : null}
        {tab === 'members' ? (
          <ResourceMembersTab
            members={members}
            pendingInvites={pendingInvites}
            canManageMembers={canManageMembers}
            notificationTopic="BOAT_MEMBERS"
            notificationBoatId={boatId}
            onRefresh={refreshMembers}
            refreshing={membersRefreshing}
            onInvite={() => setInviteOpen(true)}
            onCreateLink={async () => {
              try {
                const invite = await createBoatInviteLink(boatId)
                setPendingInvites((current) => [invite, ...current])
                await navigator.clipboard.writeText(invite.inviteUrl)
                toast.success('Invite link created and copied')
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to create invite link',
                )
              }
            }}
            onRoleChange={async (member, role: OrgMemberRole) => {
              try {
                const updated = await updateBoatMemberRole(
                  boatId,
                  member.userId,
                  role,
                )
                setMembers((current) =>
                  current.map((item) =>
                    item.userId === updated.userId ? updated : item,
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
                !window.confirm(`Remove ${member.user.name} from this boat?`)
              ) {
                return
              }
              try {
                await removeBoatMember(boatId, member.userId)
                setMembers((current) =>
                  current.filter((item) => item.userId !== member.userId),
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
                await cancelBoatInvite(boatId, invite.id)
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
              await resendBoatInvite(boatId, invite.id)
            }}
          />
        ) : null}
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite boat member"
        onSubmit={async ({ email, role }) => {
          const result = await inviteBoatMember(boatId, { email, role })
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
        title="Add boat contact"
        devComponentName="AddBoatContactModal"
        grantAreas={BOAT_CONTACT_AREAS}
        onSubmit={async (input) => {
          const contact = await createBoatContact(boatId, input)
          setContacts((current) => [...current, contact])
          toast.success('Contact added')
        }}
      />
    </main>
  )
}
