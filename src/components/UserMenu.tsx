import { useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  CircleUser,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Sailboat,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { Boat } from '../domain/boat'
import type { CrewPayload } from '../domain/crew'
import { signOut, useSession } from '../lib/auth-client'
import {
  formatAppBuildFooter,
  getAppEnvironmentLabel,
  getNativeBuildNumber,
} from '../lib/app-build-info'
import { fetchBoats } from '../lib/boats-api'
import { cn } from '../lib/cn'
import { fetchCrew } from '../lib/crew-api'
import { profilePhotoUrl } from '../lib/profile-api'
import { tripCoverPhotoUrl } from '../lib/trip-display'
import { TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS } from '../lib/trip-map-overlay'
import { useIsAdmin } from '../lib/use-admin'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'
import { useFtue } from './FtueGate'
import { ProfileModal } from './ProfileModal'

export function UserMenu({ mapOverlay = false }: { mapOverlay?: boolean }) {
  const session = useSession()
  const user = session.data?.user
  const navigate = useNavigate()
  const trips = useLogbookStore((state) => state.trips)
  const { resetTutorial } = useFtue()
  const { isAdmin } = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [boats, setBoats] = useState<Boat[]>([])
  const [crew, setCrew] = useState<CrewPayload | null>(null)
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null)
  const [buildFooter, setBuildFooter] = useState(() =>
    formatAppBuildFooter(getAppEnvironmentLabel(), null),
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const photoSrc = profilePhotoUrl(user?.image, photoVersion)
  const loadingCollections = Boolean(user) && loadedForUserId !== user?.id

  const closeMenu = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [])

  const openProfile = () => {
    setOpen(false)
    if (user) {
      setProfileOpen(true)
    } else {
      void navigate({ to: '/sign-in' })
    }
  }

  const navigateFromMenu = (navigateAction: () => void) => {
    setOpen(false)
    navigateAction()
  }

  useEffect(() => {
    void getNativeBuildNumber().then((buildNumber) => {
      setBuildFooter(
        formatAppBuildFooter(getAppEnvironmentLabel(), buildNumber),
      )
    })
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, closeMenu])

  useEffect(() => {
    if (!open) return
    void useLogbookStore.getState().load()
    if (!user) return

    let cancelled = false
    setLoadedForUserId(null)
    void Promise.all([
      fetchBoats().catch(() => [] as Boat[]),
      fetchCrew().catch(() => null),
    ]).then(([nextBoats, nextCrew]) => {
      if (cancelled) return
      setBoats(nextBoats)
      setCrew(nextCrew)
      setLoadedForUserId(user.id)
    })

    return () => {
      cancelled = true
    }
  }, [open, user?.id])

  return (
    <>
      <div className="relative">
        <DevComponentLabel name="UserMenu" className="absolute -top-5 left-0" />
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            'flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border transition outline-none',
            mapOverlay
              ? cn(
                  TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS,
                  'text-white hover:bg-white/10',
                  'focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  open && 'ring-2 ring-white/30',
                )
              : cn(
                  'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
                  'focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]',
                  open && 'ring-2 ring-[var(--line)]',
                ),
          )}
          aria-label={
            user ? `Profile: ${user.name || user.email}` : 'Profile menu'
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt=""
              className="h-full w-full object-cover"
              width={40}
              height={40}
              decoding="async"
            />
          ) : (
            <User className="h-5 w-5" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-blocking-overlay
              className="ios-map-touch-target fixed inset-0 z-[100] bg-[var(--surface-strong)] [--chip-bg:#f3f3f3] [--link-bg-hover:#f5f5f5] [--panel-border:rgba(0,0,0,0.08)] [--sea-ink:#111111] [--sea-ink-soft:#6b6b6b] [--surface-strong:#ffffff] sm:flex sm:items-center sm:justify-center sm:bg-[var(--overlay)] sm:p-5 sm:backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeMenu()
              }}
            >
              <section
                id={menuId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${menuId}-title`}
                className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--surface-strong)] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-[var(--panel-border)] sm:shadow-2xl"
              >
                <header className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-7 sm:pt-6">
                  <h2
                    id={`${menuId}-title`}
                    className="m-0 text-[2rem] font-extrabold tracking-[-0.035em] text-[var(--sea-ink)]"
                  >
                    Profile
                  </h2>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink)] outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20"
                    aria-label="Close profile menu"
                    autoFocus
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-2 sm:px-7 sm:pb-7">
                  <div className="grid grid-cols-2 gap-4">
                    <MenuCard
                      className="col-span-2 min-h-40"
                      wide
                      ariaLabel={user ? 'Edit profile' : 'Sign in'}
                      onClick={openProfile}
                    >
                      <div className="flex h-full items-center gap-5 p-5 sm:px-7">
                        <Avatar
                          src={photoSrc}
                          className="size-24 shrink-0 rounded-full sm:size-28"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-2xl font-extrabold tracking-[-0.025em] text-[var(--sea-ink)]">
                            {user?.name || (user ? user.email : 'Sign in')}
                          </p>
                          <p className="m-0 mt-2 text-sm font-medium text-[var(--sea-ink-soft)]">
                            {trips.length}{' '}
                            {trips.length === 1 ? 'trip' : 'trips'}
                          </p>
                          <p className="m-0 mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--sea-ink)]">
                            {user ? 'Edit profile' : 'Open your account'}
                            <ChevronRight className="size-3.5" aria-hidden />
                          </p>
                        </div>
                      </div>
                    </MenuCard>

                    <MenuCard
                      ariaLabel={
                        trips.length ? 'Manage trips' : 'Open map to add a trip'
                      }
                      addAction={
                        trips.length
                          ? {
                              label: 'Add trip',
                              onClick: () =>
                                navigateFromMenu(() => {
                                  void navigate({
                                    to: '/trips',
                                    search: { startTrip: true },
                                  })
                                }),
                            }
                          : undefined
                      }
                      onClick={() =>
                        navigateFromMenu(() => {
                          void navigate({
                            to: trips.length ? '/trips' : '/map',
                          })
                        })
                      }
                    >
                      <CollectionCardContent
                        title="Trips"
                        detail={collectionDetail(trips.length, 'trip')}
                        loading={false}
                        empty={trips.length === 0}
                      >
                        <PhotoMontage
                          items={trips.slice(0, 3).map((trip) => ({
                            id: trip.id,
                            src: tripCoverPhotoUrl(trip),
                            label: trip.boatName,
                            fallback: (
                              <Sailboat className="size-7" strokeWidth={1.6} />
                            ),
                          }))}
                        />
                      </CollectionCardContent>
                    </MenuCard>

                    <MenuCard
                      ariaLabel={boats.length ? 'Manage boats' : 'Add a boat'}
                      addAction={
                        boats.length
                          ? {
                              label: 'Add boat',
                              onClick: () =>
                                navigateFromMenu(() => {
                                  void navigate({
                                    to: '/boats',
                                    search: { addBoat: true },
                                  })
                                }),
                            }
                          : undefined
                      }
                      onClick={() =>
                        navigateFromMenu(() => {
                          void navigate({
                            to: '/boats',
                            search: boats.length ? {} : { addBoat: true },
                          })
                        })
                      }
                    >
                      <CollectionCardContent
                        title="Boats"
                        detail={collectionDetail(boats.length, 'boat')}
                        loading={loadingCollections}
                        empty={boats.length === 0}
                      >
                        <PhotoMontage
                          items={boats.slice(0, 3).map((boat) => ({
                            id: boat.id,
                            src:
                              boat.photos.find((photo) => photo.isDefault)
                                ?.imageUrl ??
                              boat.photos[0]?.imageUrl ??
                              null,
                            label: boat.name,
                            fallback: (
                              <Sailboat className="size-7" strokeWidth={1.6} />
                            ),
                          }))}
                        />
                      </CollectionCardContent>
                    </MenuCard>

                    <MenuCard
                      ariaLabel={
                        crew?.members.length ? 'Manage crew' : 'Add crew'
                      }
                      addAction={
                        crew?.members.length
                          ? {
                              label: 'Add crew member',
                              onClick: () =>
                                navigateFromMenu(() => {
                                  void navigate({
                                    to: '/crew',
                                    search: { addCrew: true },
                                  })
                                }),
                            }
                          : undefined
                      }
                      onClick={() =>
                        navigateFromMenu(() => {
                          void navigate({
                            to: '/crew',
                            search: crew?.members.length
                              ? {}
                              : { addCrew: true },
                          })
                        })
                      }
                    >
                      <CollectionCardContent
                        title="Crew"
                        detail={collectionDetail(
                          crew?.members.length ?? 0,
                          'member',
                        )}
                        loading={loadingCollections}
                        empty={!crew?.members.length}
                      >
                        <CrewMontage crew={crew} />
                      </CollectionCardContent>
                    </MenuCard>

                    <MenuCard
                      ariaLabel="Connections, coming soon"
                      onClick={() =>
                        toast.message('Connections are coming soon')
                      }
                    >
                      <CollectionCardContent
                        title="Connections"
                        detail="Coming soon"
                        empty
                        loading={false}
                      />
                    </MenuCard>
                  </div>

                  <nav
                    aria-label="Account options"
                    className="mt-7 border-t border-[var(--line)] pt-2"
                  >
                    {isAdmin ? (
                      <TextMenuButton
                        icon={<ShieldCheck className="size-5" />}
                        label="Admin"
                        onClick={() =>
                          navigateFromMenu(
                            () => void navigate({ to: '/admin' }),
                          )
                        }
                      />
                    ) : null}
                    <TextMenuButton
                      icon={<RotateCcw className="size-5" />}
                      label="Reset tutorial"
                      onClick={() => {
                        setOpen(false)
                        void resetTutorial().then(() =>
                          toast.message('Tutorial reset'),
                        )
                      }}
                    />
                    {user ? (
                      <TextMenuButton
                        icon={<LogOut className="size-5" />}
                        label="Sign out"
                        showChevron={false}
                        onClick={() => {
                          setOpen(false)
                          void signOut()
                        }}
                      />
                    ) : (
                      <TextMenuButton
                        icon={<LogIn className="size-5" />}
                        label="Sign in"
                        onClick={openProfile}
                      />
                    )}
                  </nav>

                  <p className="m-0 mt-5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sea-ink-soft)]">
                    {buildFooter}
                  </p>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onUpdated={() => setPhotoVersion((value) => value + 1)}
      />
    </>
  )
}

function MenuCard({
  children,
  onClick,
  ariaLabel,
  className,
  wide = false,
  addAction,
}: {
  children: ReactNode
  onClick: () => void
  ariaLabel: string
  className?: string
  wide?: boolean
  addAction?: { label: string; onClick: () => void }
}) {
  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden rounded-[1.6rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] text-left shadow-[0_10px_30px_rgba(0,0,0,0.09)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.12)]',
        wide ? 'aspect-auto' : 'aspect-square',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="size-full rounded-[inherit] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20 active:bg-[var(--link-bg-hover)]"
      >
        {children}
      </button>
      {addAction ? (
        <button
          type="button"
          onClick={addAction.onClick}
          aria-label={addAction.label}
          className="absolute bottom-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink)] shadow-sm outline-none hover:scale-105 hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:bottom-5 sm:right-5"
        >
          <Plus className="size-5" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

function CollectionCardContent({
  title,
  detail,
  loading,
  empty,
  children,
}: {
  title: string
  detail: string
  loading: boolean
  empty: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex size-full flex-col p-4 sm:p-5">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {loading ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]">
            <LoaderCircle className="size-6 animate-spin" aria-hidden />
          </div>
        ) : empty ? (
          <div className="flex size-16 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] transition group-hover:scale-105">
            <Plus className="size-7" strokeWidth={2} aria-hidden />
          </div>
        ) : (
          children
        )}
      </div>
      <div className="mt-2 shrink-0">
        <p className="m-0 text-base font-extrabold tracking-[-0.02em] text-[var(--sea-ink)] sm:text-lg">
          {title}
        </p>
        <p className="m-0 mt-0.5 truncate text-[11px] font-medium text-[var(--sea-ink-soft)] sm:text-xs">
          {loading ? 'Loading…' : detail}
        </p>
      </div>
    </div>
  )
}

type MontageItem = {
  id: string
  src: string | null
  label: string
  fallback: ReactNode
}

function PhotoMontage({ items }: { items: MontageItem[] }) {
  return (
    <div className="relative h-24 w-full max-w-36" aria-hidden>
      {items.map((item, index) => {
        const count = items.length
        const transforms =
          count === 1
            ? ['left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2']
            : count === 2
              ? [
                  'left-[12%] top-[18%] -rotate-6',
                  'right-[10%] bottom-[8%] rotate-6',
                ]
              : [
                  'left-[4%] top-[25%] -rotate-6',
                  'left-1/2 top-[6%] -translate-x-1/2 rotate-2',
                  'right-[2%] bottom-[2%] rotate-6',
                ]
        return (
          <div
            key={item.id}
            className={cn(
              'absolute flex size-[7rem] items-center justify-center overflow-hidden rounded-2xl border-[3px] border-[var(--surface-strong)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)] shadow-md',
              transforms[index],
            )}
            title={item.label}
          >
            {item.src ? (
              <img
                src={item.src}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              item.fallback
            )}
          </div>
        )
      })}
    </div>
  )
}

function CrewMontage({ crew }: { crew: CrewPayload | null }) {
  const members = crew?.members ?? []
  const shownMembers = members.slice(0, 6)
  const extraCount = members.length - shownMembers.length

  return (
    <div
      className="flex max-w-full flex-wrap items-center justify-center -space-x-3"
      aria-hidden
    >
      {shownMembers.map((member) => (
        <Avatar
          key={member.id}
          src={member.imageUrl}
          className="size-18 rounded-full border-[3px] border-[var(--surface-strong)] shadow-sm sm:size-21"
        />
      ))}
      {extraCount > 0 ? (
        <div className="z-10 flex size-18 items-center justify-center rounded-full border-[3px] border-[var(--surface-strong)] bg-[var(--chip-bg)] text-xs font-bold text-[var(--sea-ink)] shadow-sm sm:size-21">
          +{extraCount}
        </div>
      ) : null}
    </div>
  )
}

function Avatar({
  src,
  className,
}: {
  src: string | null | undefined
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <CircleUser
          className="size-1/2 min-h-6 min-w-6"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
    </div>
  )
}

function TextMenuButton({
  icon,
  label,
  onClick,
  showChevron = true,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  showChevron?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl px-2 py-4 text-left text-[var(--sea-ink)] outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)]"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-base font-semibold">{label}</span>
      {showChevron ? (
        <ChevronRight
          className="size-5 text-[var(--sea-ink-soft)]"
          aria-hidden
        />
      ) : null}
    </button>
  )
}

function collectionDetail(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}
