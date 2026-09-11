import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowLeft,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  Sailboat,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CrewAvatar } from '../../../../../components/CrewAvatar'
import { MEMBER_ROLE_LABELS } from '../../../../../domain/member-invite'
import type { ContactResourceArea } from '../../../../../domain/contact'
import { formatContactGrants } from '../../../../../domain/contact'
import type {
  OrgContactDetail,
  OrgMemberBoat,
  OrgMemberRole,
} from '../../../../../domain/org'
import {
  ContactGrantsEditor,
  ORG_CONTACT_AREAS,
} from '../../../../../components/ResourceContactsTab'
import { boatIconSrc, isBoatIconId } from '../../../../../lib/boat-icons'
import { profilePhotoUrl } from '../../../../../lib/profile-api'
import {
  addOrgContactMembership,
  fetchOrg,
  fetchOrgContactDetail,
  removeOrgMember,
  updateOrgContact,
  updateOrgMemberRole,
} from '../../../../../lib/orgs-api'

export const Route = createFileRoute('/_main/orgs/$orgId/contacts/$contactId')({
  component: OrgContactDetailPage,
})

function whatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

function OrgContactDetailPage() {
  const { orgId, contactId } = Route.useParams()
  const [orgName, setOrgName] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrgContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [whatsappDraft, setWhatsappDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [grantsDraft, setGrantsDraft] = useState<ContactResourceArea[]>([])
  const [saving, setSaving] = useState(false)
  const [savingGrants, setSavingGrants] = useState(false)
  const [membershipRole, setMembershipRole] = useState<OrgMemberRole>('MEMBER')
  const [membershipLoading, setMembershipLoading] = useState(false)

  const loadDetail = () => {
    setLoading(true)
    setError(null)
    return Promise.all([
      fetchOrg(orgId),
      fetchOrgContactDetail(orgId, contactId),
    ])
      .then(([orgPayload, contactDetail]) => {
        setOrgName(orgPayload.org.name)
        setDetail(contactDetail)
        setDisplayNameDraft(contactDetail.contact.displayName)
        setEmailDraft(contactDetail.contact.email ?? '')
        setPhoneDraft(contactDetail.contact.phone ?? '')
        setWhatsappDraft(contactDetail.contact.whatsapp ?? '')
        setNotesDraft(contactDetail.contact.notes ?? '')
        setGrantsDraft(contactDetail.contact.grants)
        setMembershipRole(contactDetail.member?.role ?? 'MEMBER')
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load contact')
        setDetail(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void loadDetail()
  }, [orgId, contactId])

  const handleSaveContact = async (event: FormEvent) => {
    event.preventDefault()
    if (!detail) return
    setSaving(true)
    try {
      const contact = await updateOrgContact(orgId, contactId, {
        displayName: displayNameDraft.trim(),
        email: emailDraft.trim() || null,
        phone: phoneDraft.trim() || null,
        whatsapp: whatsappDraft.trim() || null,
        notes: notesDraft.trim() || null,
      })
      setDetail((current) => (current ? { ...current, contact } : current))
      setEditing(false)
      toast.success('Contact info updated')
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to save contact info',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (!detail) return
    setDisplayNameDraft(detail.contact.displayName)
    setEmailDraft(detail.contact.email ?? '')
    setPhoneDraft(detail.contact.phone ?? '')
    setWhatsappDraft(detail.contact.whatsapp ?? '')
    setNotesDraft(detail.contact.notes ?? '')
    setEditing(false)
  }

  const handleAddMembership = async () => {
    setMembershipLoading(true)
    try {
      const result = await addOrgContactMembership(orgId, contactId, {
        role: membershipRole,
      })
      if ('member' in result && result.member) {
        toast.success('Added as org member')
      } else {
        toast.success('Invite sent')
      }
      await loadDetail()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add membership')
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleRoleChange = async (role: OrgMemberRole) => {
    if (!detail?.member) return
    try {
      const member = await updateOrgMemberRole(
        orgId,
        detail.member.userId,
        role,
      )
      setDetail((current) => (current ? { ...current, member } : current))
      setMembershipRole(role)
      toast.success('Role updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role')
    }
  }

  const handleRemoveMembership = async () => {
    if (!detail?.member) return
    if (
      !window.confirm(
        `Remove ${detail.contact.displayName} from org membership? Their contact info will stay in the org.`,
      )
    ) {
      return
    }
    try {
      await removeOrgMember(orgId, detail.member.userId)
      toast.success('Removed from org membership')
      await loadDetail()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove member')
    }
  }

  const handleSaveGrants = async () => {
    if (!detail?.canManageGrants) return
    setSavingGrants(true)
    try {
      const contact = await updateOrgContact(orgId, contactId, {
        grants: grantsDraft,
      })
      setDetail((current) => (current ? { ...current, contact } : current))
      toast.success('Guest access updated')
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to update guest access',
      )
    } finally {
      setSavingGrants(false)
    }
  }

  const backTab = detail?.member ? 'members' : 'contacts'

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading contact…</p>
      </main>
    )
  }

  if (error || !detail) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <Link
          to="/orgs/$orgId"
          params={{ orgId }}
          search={{ tab: 'contacts' }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline hover:text-[var(--brand-hover)]"
        >
          <ArrowLeft className="size-4" />
          Back to org
        </Link>
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Contact not found'}
        </p>
      </main>
    )
  }

  const {
    contact,
    member,
    boats,
    canEditContact,
    canManageMembership,
    canManageGrants,
  } = detail
  const avatarName = member?.user.name ?? contact.displayName
  const avatarImage = member?.user.image ?? null

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/orgs/$orgId"
        params={{ orgId }}
        search={{ tab: backTab }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline hover:text-[var(--brand-hover)]"
      >
        <ArrowLeft className="size-4" />
        {orgName ?? 'Org'}
      </Link>

      <div className="flex items-start gap-4">
        <CrewAvatar
          name={avatarName}
          imageUrl={profilePhotoUrl(avatarImage)}
          className="size-16"
        />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-2xl font-bold text-[var(--sea-ink)]">
            {contact.displayName}
          </h1>
          <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
            {member
              ? `${MEMBER_ROLE_LABELS[member.role]} · org member`
              : `Contact · ${formatContactGrants(contact.grants)}`}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
            Contact info
          </h2>
          {canEditContact && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
            >
              Edit
            </button>
          ) : null}
        </div>

        {editing ? (
          <form
            onSubmit={(e) => void handleSaveContact(e)}
            className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Name
              </span>
              <input
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Email
              </span>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Phone
              </span>
              <input
                type="tel"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                WhatsApp
              </span>
              <input
                type="tel"
                value={whatsappDraft}
                onChange={(e) => setWhatsappDraft(e.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Notes
              </span>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !displayNameDraft.trim()}
                className="rounded-xl bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
            <ContactRow
              icon={<Mail className="size-4" />}
              label="Email"
              value={contact.email}
              href={contact.email ? `mailto:${contact.email}` : undefined}
              connectLabel="Email"
            />
            <ContactRow
              icon={<Phone className="size-4" />}
              label="Phone"
              value={contact.phone}
              href={contact.phone ? `tel:${contact.phone}` : undefined}
              connectLabel="Call"
            />
            <ContactRow
              icon={<MessageCircle className="size-4" />}
              label="WhatsApp"
              value={contact.whatsapp}
              href={
                contact.whatsapp ? whatsAppUrl(contact.whatsapp) : undefined
              }
              connectLabel="WhatsApp"
              external
            />
            {contact.notes ? (
              <div className="px-2 py-2">
                <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
                  Notes
                </p>
                <p className="m-0 mt-0.5 text-sm leading-5 text-[var(--sea-ink)]">
                  {contact.notes}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
          Guest access
        </h2>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          Linked registered users can view only the selected org areas. No
          invite is sent.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
          <ContactGrantsEditor
            areas={ORG_CONTACT_AREAS}
            grants={grantsDraft}
            onChange={setGrantsDraft}
            disabled={!canManageGrants}
          />
          {canManageGrants ? (
            <button
              type="button"
              disabled={savingGrants}
              onClick={() => void handleSaveGrants()}
              className="mt-4 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {savingGrants ? 'Saving…' : 'Save guest access'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="m-0 mb-3 text-lg font-semibold text-[var(--sea-ink)]">
          Org membership
        </h2>
        {member ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
            <p className="m-0 text-sm text-[var(--sea-ink)]">
              {MEMBER_ROLE_LABELS[member.role]} · joined{' '}
              {new Date(member.createdAt).toLocaleDateString()}
            </p>
            {canManageMembership ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) =>
                    void handleRoleChange(e.target.value as OrgMemberRole)
                  }
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]"
                >
                  {Object.entries(MEMBER_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleRemoveMembership()}
                  className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
                >
                  Remove from org
                </button>
              </div>
            ) : null}
          </div>
        ) : canManageMembership ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              Not an org member. Add membership to give app access while keeping
              this contact info.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select
                value={membershipRole}
                onChange={(e) =>
                  setMembershipRole(e.target.value as OrgMemberRole)
                }
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]"
              >
                {Object.entries(MEMBER_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={membershipLoading || !contact.email}
                onClick={() => void handleAddMembership()}
                className="rounded-xl bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {membershipLoading ? 'Adding…' : 'Add as member'}
              </button>
            </div>
            {!contact.email ? (
              <p className="m-0 mt-3 text-xs text-[var(--sea-ink-soft)]">
                Add an email above before inviting as a member.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Not an org member.
          </p>
        )}
      </section>

      {member ? (
        <section className="mt-8">
          <h2 className="m-0 mb-3 text-lg font-semibold text-[var(--sea-ink)]">
            Boats in org
          </h2>
          {boats.length === 0 ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">
              No boats linked to this org yet.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {boats.map((boat) => (
                <BoatRow key={boat.id} boat={boat} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
  connectLabel,
  external,
}: {
  icon: ReactNode
  label: string
  value: string | null
  href?: string
  connectLabel: string
  external?: boolean
}) {
  const handleCopy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2">
      <span className="mt-0.5 text-[var(--sea-ink-soft)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--sea-ink-soft)]">
          {label}
        </p>
        <p className="m-0 mt-0.5 break-all text-sm text-[var(--sea-ink)]">
          {value ?? '—'}
        </p>
      </div>
      {value && href ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
            aria-label={`Copy ${label}`}
          >
            <Copy className="size-3.5" />
            Copy
          </button>
          <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center rounded-full bg-[var(--btn-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--btn-text)] no-underline transition hover:opacity-90"
          >
            {connectLabel}
          </a>
        </div>
      ) : null}
    </div>
  )
}

function BoatRow({ boat }: { boat: OrgMemberBoat }) {
  const iconId = isBoatIconId(boat.iconId) ? boat.iconId : 'medium'

  return (
    <li className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3">
      <Link
        to="/boats/$boatId"
        params={{ boatId: boat.id }}
        className="flex items-center gap-3 no-underline"
      >
        <img src={boatIconSrc(iconId)} alt="" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {boat.name}
          </p>
          <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
            {boat.shareCount} {boat.shareCount === 1 ? 'share' : 'shares'} in
            org
            {boat.isBoatOwner ? ' · boat owner' : ''}
            {boat.boatMemberRole
              ? ` · ${MEMBER_ROLE_LABELS[boat.boatMemberRole]}`
              : ''}
          </p>
        </div>
        <Sailboat className="size-4 shrink-0 text-[var(--sea-ink-soft)]" />
      </Link>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        {boat.ownedShares.length === 0 ? (
          <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
            No shares owned
          </p>
        ) : (
          <>
            <p className="m-0 text-xs font-medium text-[var(--sea-ink-soft)]">
              Owns {boat.ownedShares.length} of {boat.shareCount}{' '}
              {boat.shareCount === 1 ? 'share' : 'shares'}
            </p>
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {boat.ownedShares.map((share) => (
                <li key={share.id} className="text-sm text-[var(--sea-ink)]">
                  {share.displayName}
                  <span className="text-[var(--sea-ink-soft)]">
                    {' '}
                    (share {share.sequence + 1} of {boat.shareCount})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  )
}
