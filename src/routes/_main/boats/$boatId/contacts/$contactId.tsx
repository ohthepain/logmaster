import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail, MessageCircle, Phone } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BOAT_CONTACT_AREAS,
  ContactGrantsEditor,
} from '../../../../../components/ResourceContactsTab'
import type {
  BoatContactDetail,
  ContactResourceArea,
} from '../../../../../domain/contact'
import { formatContactGrants } from '../../../../../domain/contact'
import { fetchBoat } from '../../../../../lib/boats-api'
import {
  fetchBoatContactDetail,
  updateBoatContact,
} from '../../../../../lib/boat-contacts-api'

export const Route = createFileRoute(
  '/_main/boats/$boatId/contacts/$contactId',
)({
  component: BoatContactDetailPage,
})

function whatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

function ContactRow({
  icon,
  label,
  value,
  href,
  connectLabel,
}: {
  icon: ReactNode
  label: string
  value: string | null
  href?: string
  connectLabel?: string
}) {
  if (!value) {
    return (
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{label}: not set</p>
    )
  }
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-[var(--sea-ink)]">
      <span className="inline-flex items-center gap-1.5 text-[var(--sea-ink-soft)]">
        {icon}
        {label}:
      </span>
      {href ? (
        <a href={href} className="font-medium text-[var(--brand)] no-underline">
          {connectLabel ?? value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </p>
  )
}

function BoatContactDetailPage() {
  const { boatId, contactId } = Route.useParams()
  const [boatName, setBoatName] = useState<string | null>(null)
  const [detail, setDetail] = useState<BoatContactDetail | null>(null)
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

  const loadDetail = () => {
    setLoading(true)
    setError(null)
    return Promise.all([
      fetchBoat(boatId),
      fetchBoatContactDetail(boatId, contactId),
    ])
      .then(([boatPayload, contactDetail]) => {
        setBoatName(boatPayload.boat.name)
        setDetail(contactDetail)
        setDisplayNameDraft(contactDetail.contact.displayName)
        setEmailDraft(contactDetail.contact.email ?? '')
        setPhoneDraft(contactDetail.contact.phone ?? '')
        setWhatsappDraft(contactDetail.contact.whatsapp ?? '')
        setNotesDraft(contactDetail.contact.notes ?? '')
        setGrantsDraft(contactDetail.contact.grants)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load contact')
        setDetail(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void loadDetail()
  }, [boatId, contactId])

  const handleSaveContact = async (event: FormEvent) => {
    event.preventDefault()
    if (!detail) return
    setSaving(true)
    try {
      const contact = await updateBoatContact(boatId, contactId, {
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

  const handleSaveGrants = async () => {
    if (!detail?.canManageGrants) return
    setSavingGrants(true)
    try {
      const contact = await updateBoatContact(boatId, contactId, {
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
          to="/boats/$boatId"
          params={{ boatId }}
          search={{ tab: 'contacts' }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline hover:text-[var(--brand-hover)]"
        >
          <ArrowLeft className="size-4" />
          Back to boat
        </Link>
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Contact not found'}
        </p>
      </main>
    )
  }

  const { contact, canEditContact, canManageGrants } = detail

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/boats/$boatId"
        params={{ boatId }}
        search={{ tab: 'contacts' }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] no-underline hover:text-[var(--brand-hover)]"
      >
        <ArrowLeft className="size-4" />
        {boatName ?? 'Boat'}
      </Link>

      <div>
        <h1 className="m-0 text-2xl font-bold text-[var(--sea-ink)]">
          {contact.displayName}
        </h1>
        <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
          Boat contact · {formatContactGrants(contact.grants)}
        </p>
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
                onClick={() => {
                  setDisplayNameDraft(contact.displayName)
                  setEmailDraft(contact.email ?? '')
                  setPhoneDraft(contact.phone ?? '')
                  setWhatsappDraft(contact.whatsapp ?? '')
                  setNotesDraft(contact.notes ?? '')
                  setEditing(false)
                }}
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
            />
            <ContactRow
              icon={<Phone className="size-4" />}
              label="Phone"
              value={contact.phone}
              href={contact.phone ? `tel:${contact.phone}` : undefined}
            />
            <ContactRow
              icon={<MessageCircle className="size-4" />}
              label="WhatsApp"
              value={contact.whatsapp}
              href={
                contact.whatsapp ? whatsAppUrl(contact.whatsapp) : undefined
              }
              connectLabel="Open WhatsApp"
            />
            {contact.notes ? (
              <p className="m-0 pt-2 text-sm leading-6 text-[var(--sea-ink)]">
                {contact.notes}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
          Guest access
        </h2>
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
          Linked registered users can view only the selected boat areas. No
          invite is sent.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-4">
          <ContactGrantsEditor
            areas={BOAT_CONTACT_AREAS}
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
    </main>
  )
}
