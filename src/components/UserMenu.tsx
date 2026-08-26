import { Link } from '@tanstack/react-router'
import { BookOpenText, User } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { signOut, useSession } from '../lib/auth-client'
import { profilePhotoUrl } from '../lib/profile-api'
import {
  formatAppBuildFooter,
  getAppEnvironmentLabel,
  getNativeBuildNumber,
} from '../lib/app-build-info'
import { cn } from '../lib/cn'
import { ProfileModal } from './ProfileModal'
import { DevComponentLabel } from './DevComponentLabel'
import { DevHomeStats } from './DevHomeStats'
import { useIsAdmin } from '../lib/use-admin'
import { useFtue } from './FtueGate'
import { TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS } from '../lib/trip-map-overlay'

export function UserMenu({ mapOverlay = false }: { mapOverlay?: boolean }) {
  const session = useSession()
  const user = session.data?.user
  const { resetTutorial } = useFtue()
  const { isAdmin } = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [buildFooter, setBuildFooter] = useState(() =>
    formatAppBuildFooter(getAppEnvironmentLabel(), null),
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const photoSrc = profilePhotoUrl(user?.image, photoVersion)

  const openProfile = () => {
    setOpen(false)
    setProfileOpen(true)
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
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <div className="relative" ref={rootRef}>
        <DevComponentLabel name="UserMenu" className="absolute -top-5 left-0" />
        <button
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
            user ? `Account: ${user.name || user.email}` : 'Account menu'
          }
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
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

        {open && (
          <div
            id={menuId}
            role="menu"
            aria-label="Account"
            className={cn(
              'ios-map-touch-target absolute right-0 top-full z-[100] mt-2 min-w-[14rem] rounded-2xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-2xl backdrop-blur-md',
              'ring-1 ring-[var(--line)]/60',
            )}
          >
            {user ? (
              <button
                type="button"
                role="menuitem"
                onClick={openProfile}
                className={cn(
                  'w-full border-b border-[var(--line)] px-3 py-2.5 text-left transition',
                  'outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20',
                )}
              >
                <p className="m-0 max-w-[16rem] truncate text-sm font-semibold text-[var(--sea-ink)]">
                  {user.name || user.email}
                </p>
                {user.email && (
                  <p className="m-0 mt-0.5 max-w-[16rem] truncate text-xs text-[var(--sea-ink-soft)]">
                    {user.email}
                  </p>
                )}
              </button>
            ) : (
              <div
                className="border-b border-[var(--line)] px-3 py-2.5"
                role="none"
              >
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                  Offline mode ready
                </p>
                <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">
                  Sign in later to sync across devices.
                </p>
              </div>
            )}

            <DevHomeStats />

            <Link
              to="/trips"
              role="menuitem"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--brand)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
              onClick={() => setOpen(false)}
            >
              <span className="inline-flex items-center gap-2">
                <BookOpenText className="size-4" strokeWidth={2} aria-hidden />
                Trips
              </span>
            </Link>
            <Link
              to="/boats"
              role="menuitem"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--brand)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
              onClick={() => setOpen(false)}
            >
              Boats
            </Link>
            <Link
              to="/crew"
              role="menuitem"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--brand)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
              onClick={() => setOpen(false)}
            >
              Crew
            </Link>

            {isAdmin ? (
              <Link
                to="/admin"
                role="menuitem"
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--brand)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            ) : null}

            <button
              type="button"
              role="menuitem"
              className={cn(
                'w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)]',
                'outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20',
              )}
              onClick={() => {
                setOpen(false)
                void resetTutorial().then(() => {
                  toast.message('Tutorial reset')
                })
              }}
            >
              Reset tutorial
            </button>

            {user ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)]',
                    'outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20',
                  )}
                  onClick={openProfile}
                >
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)]',
                    'outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20',
                  )}
                  onClick={() => {
                    setOpen(false)
                    void signOut()
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                role="menuitem"
                className="block rounded-xl px-3 py-2 text-sm font-medium text-[var(--sea-ink)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            )}

            <div
              className="mt-1 border-t border-[var(--line)] px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--sea-ink-soft)]"
              role="none"
              aria-hidden
            >
              {buildFooter}
            </div>
          </div>
        )}
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onUpdated={() => setPhotoVersion((value) => value + 1)}
      />
    </>
  )
}
