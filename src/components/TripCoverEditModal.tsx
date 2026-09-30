import { Camera, Check, Image, Mail, Map, Plus, Trash2, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { TripCrewUser } from '../domain/connections'
import { cn } from '../lib/cn'
import type { TripCrewInviteSummary } from '../lib/crew-api'
import { useTranslation } from '../lib/i18n'
import type { InviteLocale } from '../lib/invite-locale'
import type { TripDetailCoverDisplay } from '../lib/trip-display'
import { CrewAvatar } from './CrewAvatar'
import { InviteLanguageSelect } from './InviteLanguageSelect'
import { Modal } from './Modal'

type TripCoverEditModalProps = {
  open: boolean
  busy: boolean
  cover: TripDetailCoverDisplay
  title: string
  subtitle: string
  titlePlaceholder?: string
  crewPeople: TripCrewUser[]
  selectedCrewIds: string[]
  requiredCrewIds?: string[]
  crewEditable?: boolean
  pendingInvites?: TripCrewInviteSummary[]
  onCrewChange: (ids: string[]) => void
  onInviteByEmail: (input: {
    email: string
    inviteLocale: InviteLocale
  }) => Promise<{ message: string }>
  onCancelInvite: (inviteId: string) => Promise<void>
  onClose: () => void
  onSaveDetails: (input: { title: string; subtitle: string }) => void
  onChoosePhoto: () => void
  onChooseMap: () => void
  onUseCurrentMap: () => void
  onRemoveCover: () => void
  showUseCurrentMap?: boolean
}

export function TripCoverEditModal({
  open,
  busy,
  cover,
  title,
  subtitle,
  titlePlaceholder,
  crewPeople,
  selectedCrewIds,
  requiredCrewIds = [],
  crewEditable = false,
  pendingInvites = [],
  onCrewChange,
  onInviteByEmail,
  onCancelInvite,
  onClose,
  onSaveDetails,
  onChoosePhoto,
  onChooseMap,
  onUseCurrentMap,
  onRemoveCover,
  showUseCurrentMap = false,
}: TripCoverEditModalProps) {
  const { t } = useTranslation()
  const [draftTitle, setDraftTitle] = useState(title)
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraftTitle(title)
    setDraftSubtitle(subtitle)
  }, [open, title, subtitle])

  useEffect(() => {
    if (!open) setAddOpen(false)
  }, [open])

  if (!open) return null

  const hasCover = cover.kind !== 'none'
  const detailsDirty =
    draftTitle.trim() !== title.trim() ||
    draftSubtitle.trim() !== subtitle.trim()
  const selectedCrew = crewPeople.filter((person) =>
    selectedCrewIds.includes(person.id),
  )

  const handleClose = () => {
    if (busy) return
    if (detailsDirty) {
      onSaveDetails({
        title: draftTitle.trim(),
        subtitle: draftSubtitle.trim(),
      })
    }
    onClose()
  }

  const saveDetailsIfDirty = () => {
    if (detailsDirty) {
      onSaveDetails({
        title: draftTitle.trim(),
        subtitle: draftSubtitle.trim(),
      })
    }
  }

  const handleCoverAction = (action: () => void) => {
    saveDetailsIfDirty()
    action()
  }

  const removeCrew = (memberId: string) => {
    if (!crewEditable || requiredCrewIds.includes(memberId)) return
    onCrewChange(selectedCrewIds.filter((id) => id !== memberId))
  }

  return (
    <>
      <Modal
        title={t('editTripCover')}
        onClose={handleClose}
        layer="overlay"
        closeOnEscape={!addOpen}
        closeOnOutside={!addOpen}
        devComponentName="TripCoverEditModal"
      >
        <div className="grid gap-4">
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
                Title
              </span>
              <input
                type="text"
                value={draftTitle}
                disabled={busy}
                placeholder={titlePlaceholder}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
                Detail
              </span>
              <textarea
                value={draftSubtitle}
                disabled={busy}
                rows={3}
                placeholder="A short description for the trips list"
                onChange={(event) => setDraftSubtitle(event.target.value)}
                className="w-full resize-none rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm leading-6 text-[var(--sea-ink)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
              />
            </label>
            {detailsDirty ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onSaveDetails({
                    title: draftTitle.trim(),
                    subtitle: draftSubtitle.trim(),
                  })
                }
                className="justify-self-start rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                Save details
              </button>
            ) : null}
          </div>

          <section>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
                Crew
              </span>
              {crewEditable ? (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] transition hover:text-[var(--brand-hover)]"
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  Add
                </button>
              ) : null}
            </div>

            {selectedCrew.length || pendingInvites.length ? (
              <ul className="mt-3 space-y-2">
                {selectedCrew.map((member) => {
                  const locked = requiredCrewIds.includes(member.id)
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5"
                    >
                      <CrewAvatar
                        name={member.name}
                        imageUrl={member.imageUrl}
                        userId={member.id}
                        className="size-11"
                      />
                      <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-[var(--sea-ink)]">
                        {member.name}
                      </p>
                      {crewEditable && !locked ? (
                        <button
                          type="button"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => removeCrew(member.id)}
                          className="inline-flex size-8 items-center justify-center rounded-full text-[var(--sea-ink-soft)] transition hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)]"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]">
                      <Mail className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
                        {invite.email}
                      </p>
                      <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                        Invite pending
                      </p>
                    </div>
                    {crewEditable ? (
                      <button
                        type="button"
                        aria-label={`Cancel invite to ${invite.email}`}
                        onClick={() => void onCancelInvite(invite.id)}
                        className="inline-flex size-8 items-center justify-center rounded-full text-[var(--sea-ink-soft)] transition hover:bg-[var(--chip-bg)] hover:text-[var(--sea-ink)]"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-0 mt-3 text-sm text-[var(--sea-ink-soft)]">
                No crew added yet.
              </p>
            )}
            {!crewEditable ? (
              <p className="mb-0 mt-3 text-xs text-[var(--sea-ink-soft)]">
                This trip’s crew is preserved. Everyone retains access to the
                trip and its chat.
              </p>
            ) : null}
          </section>

          <div>
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Choose a photo, use the trip map, or leave the cover blank.
            </p>

            <div className="mt-4 grid gap-2">
              <CoverOption
                icon={Image}
                title="Photo"
                description="Upload your own image"
                selected={cover.kind === 'photo'}
                disabled={busy}
                onClick={() => handleCoverAction(onChoosePhoto)}
              />
              <CoverOption
                icon={Map}
                title="Map"
                description="Shows your position while underway, or the route when complete"
                selected={cover.kind === 'map'}
                disabled={busy}
                onClick={() => handleCoverAction(onChooseMap)}
              />
              {showUseCurrentMap ? (
                <CoverOption
                  icon={Camera}
                  title="Use current map"
                  description="Save what the map is showing now as the trip cover photo"
                  selected={false}
                  disabled={busy}
                  onClick={() => handleCoverAction(onUseCurrentMap)}
                />
              ) : null}
            </div>

            {hasCover ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleCoverAction(onRemoveCover)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-300"
              >
                <Trash2 className="size-4" />
                Remove cover
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
      <AddTripCrewModal
        open={addOpen}
        contacts={crewPeople.filter(
          (person) => !selectedCrewIds.includes(person.id),
        )}
        onClose={() => setAddOpen(false)}
        onAddContacts={(memberIds) => {
          const next = [...selectedCrewIds]
          for (const memberId of memberIds) {
            if (!next.includes(memberId)) next.push(memberId)
          }
          if (next.length === selectedCrewIds.length) return
          onCrewChange(next)
        }}
        onInviteByEmail={onInviteByEmail}
      />
    </>
  )
}

export function AddTripCrewModal({
  open,
  contacts,
  onClose,
  onAddContacts,
  onInviteByEmail,
}: {
  open: boolean
  contacts: TripCrewUser[]
  onClose: () => void
  onAddContacts: (memberIds: string[]) => void
  onInviteByEmail: TripCoverEditModalProps['onInviteByEmail']
}) {
  const { language } = useTranslation()
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [inviteLocale, setInviteLocale] = useState<InviteLocale>(language)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setPickedIds([])
    setEmail('')
    setInviteLocale(language)
    setSending(false)
  }, [open, language])

  if (!open) return null

  const toggleContact = (memberId: string) => {
    setPickedIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    )
  }

  const handleAdd = () => {
    if (!pickedIds.length || sending) return
    onAddContacts(pickedIds)
    onClose()
  }

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Enter a valid email address')
      return
    }
    setSending(true)
    try {
      const result = await onInviteByEmail({
        email: trimmed,
        inviteLocale,
      })
      toast.success(result.message)
      setEmail('')
      onClose()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send invite',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title="Add crew"
      onClose={() => {
        if (sending) return
        onClose()
      }}
      layer="top"
      devComponentName="AddTripCrewModal"
    >
      <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
        Select contacts, then add them to this crew.
      </p>

      {contacts.length ? (
        <ul className="mt-4 space-y-2">
          {contacts.map((member) => {
            const picked = pickedIds.includes(member.id)
            return (
              <li key={member.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => toggleContact(member.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                    picked
                      ? 'border-green-600/25 bg-green-50 dark:border-green-500/30 dark:bg-green-950/35'
                      : 'border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--chip-bg)]',
                  )}
                >
                  <CrewAvatar
                    name={member.name}
                    imageUrl={member.imageUrl}
                    userId={member.id}
                    className="size-11"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--sea-ink)]">
                    {member.name}
                  </span>
                  {picked ? (
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
                      <Check className="size-4" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-0 mt-4 text-sm text-[var(--sea-ink-soft)]">
          Everyone in your contacts is already on this trip.
        </p>
      )}

      {contacts.length ? (
        <button
          type="button"
          disabled={!pickedIds.length || sending}
          onClick={handleAdd}
          className="mt-4 inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          Add
        </button>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => void handleInvite(event)}
        className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5"
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-[var(--sea-ink)]">
            Or invite by email
          </span>
          <input
            type="email"
            inputMode="email"
            value={email}
            disabled={sending}
            placeholder="alex@example.com"
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            className="ios-map-touch-target w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--brand)] disabled:opacity-60"
          />
          <span className="text-xs leading-5 text-[var(--sea-ink-soft)]">
            Sends a crew invite. When they accept, they join this trip.
          </span>
        </label>
        {email.trim() ? (
          <InviteLanguageSelect
            value={inviteLocale}
            onChange={setInviteLocale}
            disabled={sending}
          />
        ) : null}
        <button
          type="submit"
          disabled={sending}
          className="ios-map-touch-target justify-self-start rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send crew invite'}
        </button>
      </form>
    </Modal>
  )
}

type CoverOptionProps = {
  icon: typeof Image
  title: string
  description: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}

function CoverOption({
  icon: Icon,
  title,
  description,
  selected,
  disabled,
  onClick,
}: CoverOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
        selected
          ? 'border-[var(--brand)] bg-[var(--brand-muted)]'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] hover:bg-[var(--link-bg-hover)]',
        disabled && 'opacity-60',
      )}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--sea-ink)]">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--sea-ink)]">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--sea-ink-soft)]">
          {description}
        </span>
      </span>
    </button>
  )
}
