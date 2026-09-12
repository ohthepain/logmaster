import { Link } from '@tanstack/react-router'
import { Mail, Plus, Sailboat, Trash2 } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'
import { BOAT_CONTACT_AREAS, ORG_CONTACT_AREAS } from '../domain/contact'
import type {
  BoatContactGroup,
  ContactResourceArea,
  ResourceContact,
} from '../domain/contact'
import { useTranslation } from '../lib/i18n'
import { translateContactArea } from '../lib/resource-section-i18n'
import { Modal } from './Modal'
import { ResourceSectionHeader } from './NotificationBellToggle'

type ContactRow = ResourceContact & { id: string }

function ContactGrantBadges({ grants }: { grants: ContactResourceArea[] }) {
  const { t } = useTranslation()
  const text =
    grants.length === 0
      ? t('addressBookOnly')
      : grants.map((grant) => translateContactArea(grant, t)).join(', ')
  return <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">{text}</p>
}

function ContactListItem({
  contact,
  linkTo,
  linkParams,
  onDelete,
  canDelete,
}: {
  contact: ContactRow
  linkTo: string
  linkParams: Record<string, string>
  onDelete?: (contact: ContactRow) => void
  canDelete?: boolean
}) {
  const { t } = useTranslation()
  return (
    <li className="flex flex-wrap items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3">
      <Link
        to={linkTo}
        params={linkParams}
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
        <ContactGrantBadges grants={contact.grants} />
        {contact.notes ? (
          <p className="m-0 mt-2 text-xs leading-5 text-[var(--sea-ink-soft)]">
            {contact.notes}
          </p>
        ) : null}
      </Link>
      {canDelete && onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(contact)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <Trash2 className="size-3.5" />
          {t('delete')}
        </button>
      ) : null}
    </li>
  )
}

export function ContactGrantsEditor({
  areas,
  grants,
  onChange,
  disabled = false,
}: {
  areas: readonly ContactResourceArea[]
  grants: ContactResourceArea[]
  onChange: (grants: ContactResourceArea[]) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => {
        const checked = grants.includes(area)
        return (
          <label
            key={area}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)]"
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                onChange(
                  checked
                    ? grants.filter((grant) => grant !== area)
                    : [...grants, area],
                )
              }}
            />
            {translateContactArea(area, t)}
          </label>
        )
      })}
    </div>
  )
}

export function AddContactModal({
  open,
  onClose,
  title,
  devComponentName = 'AddContactModal',
  grantAreas = [],
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title?: string
  devComponentName?: string
  grantAreas?: readonly ContactResourceArea[]
  onSubmit: (input: {
    displayName: string
    email?: string
    phone?: string
    whatsapp?: string
    notes?: string
    grants: ContactResourceArea[]
  }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [notes, setNotes] = useState('')
  const [grants, setGrants] = useState<ContactResourceArea[]>([])
  const [loading, setLoading] = useState(false)
  const resolvedTitle = title ?? t('addContact')

  if (!open) return null

  const reset = () => {
    setDisplayName('')
    setEmail('')
    setPhone('')
    setWhatsapp('')
    setNotes('')
    setGrants([])
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
      await onSubmit({
        displayName: name,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        notes: notes.trim() || undefined,
        grants,
      })
      reset()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={resolvedTitle}
      onClose={handleClose}
      devComponentName={devComponentName}
    >
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
        {grantAreas.length > 0 ? (
          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--sea-ink)]">
              Guest access
            </span>
            <ContactGrantsEditor
              areas={grantAreas}
              grants={grants}
              onChange={setGrants}
            />
            <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">
              Linked registered users can view only the selected areas. No
              invite is sent.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {loading ? t('saving') : t('addContact')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleClose}
            className="rounded-full border border-[var(--chip-line)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function ResourceContactsTab({
  title,
  description,
  contacts,
  boatContactGroups = [],
  canManage = false,
  onAdd,
  onDelete,
  getContactLink,
  onRefresh,
  refreshing = false,
  notificationTopic,
  notificationOrgId,
  notificationBoatId,
  headerActions,
}: {
  title?: string
  description?: string
  contacts: ContactRow[]
  boatContactGroups?: BoatContactGroup[]
  canManage?: boolean
  onAdd?: () => void
  onDelete?: (contact: ContactRow) => void
  getContactLink: (contact: ContactRow) => {
    to: string
    params: Record<string, string>
  }
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
  notificationTopic?: 'ORG_CONTACTS' | 'BOAT_CONTACTS'
  notificationOrgId?: string
  notificationBoatId?: string
  headerActions?: ReactNode
}) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('contacts')
  const totalBoatContacts = boatContactGroups.reduce(
    (count, group) => count + group.contacts.length,
    0,
  )
  const totalCount = contacts.length + totalBoatContacts

  return (
    <div>
      <ResourceSectionHeader
        title={resolvedTitle}
        topic={notificationTopic}
        orgId={notificationOrgId}
        boatId={notificationBoatId}
        onRefresh={onRefresh}
        refreshing={refreshing}
        actions={
          headerActions ??
          (canManage && onAdd ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:text-[var(--brand-hover)]"
            >
              <Plus className="size-4" />
              {t('addContact')}
            </button>
          ) : null)
        }
      />
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
        {description ??
          t(totalCount === 1 ? 'contactCountOne' : 'contactCountOther', {
            count: totalCount,
          })}
      </p>

      {contacts.length === 0 && boatContactGroups.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          {t('noContactsYet')}
        </p>
      ) : null}

      {contacts.length > 0 ? (
        <section className="mb-8">
          {boatContactGroups.length > 0 ? (
            <h3 className="mb-3 text-sm font-semibold text-[var(--sea-ink)]">
              {t('orgContacts')}
            </h3>
          ) : null}
          <ul className="m-0 list-none space-y-2 p-0">
            {contacts.map((contact) => {
              const link = getContactLink(contact)
              return (
                <ContactListItem
                  key={contact.id}
                  contact={contact}
                  linkTo={link.to}
                  linkParams={link.params}
                  canDelete={canManage}
                  onDelete={onDelete}
                />
              )
            })}
          </ul>
        </section>
      ) : null}

      {boatContactGroups.map((group) => (
        <section key={group.boatId} className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
            <Sailboat className="size-4" />
            {group.boatName}
          </h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {group.contacts.map((contact) => {
              const link = getContactLink(contact)
              return (
                <ContactListItem
                  key={contact.id}
                  contact={contact}
                  linkTo={link.to}
                  linkParams={link.params}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export { BOAT_CONTACT_AREAS, ORG_CONTACT_AREAS }
