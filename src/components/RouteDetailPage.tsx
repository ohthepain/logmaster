import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Map as MapIcon, MapPin, MessageSquarePlus, Pencil, Sailboat } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Route, RouteAnnotation, RouteWaypoint } from '../domain/route'
import { cn } from '../lib/cn'
import { readImageFile } from '../lib/image-file'
import {
  formatRouteListDistanceMeters,
  formatRouteListWaypointCount,
  formatRouteUpdatedLabel,
  resolveRouteCoverKind,
  routeCoverPhotoUrl,
  routeDetailCoverDisplay,
  routeListSubtitle,
  routePlannedDistanceMeters,
} from '../lib/route-display'
import type { TripMapHandle } from '../lib/trip-map-handle'
import { DevComponentLabel } from './DevComponentLabel'
import { RouteActionsMenu } from './RouteActionsMenu'
import { RouteCoverEditModal } from './RouteCoverEditModal'
import { RouteMap } from './RouteMap'
import { TripMapChromeButton } from './TripMapChromeButton'
import {
  TripImportButton,
  type TripImportButtonHandle,
} from './TripImportButton'
import {
  routeAnnotationsForRoute,
  routeWaypointsForRoute,
  useRoutesStore,
} from '../stores/routes'

type RouteDetailPageProps = {
  routeId: string
}

export function RouteDetailPage({ routeId }: RouteDetailPageProps) {
  const navigate = useNavigate()
  const store = useRoutesStore()
  const mapRef = useRef<TripMapHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoMapCoverAttemptedRef = useRef<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentWaypointId, setCommentWaypointId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [coverEditOpen, setCoverEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void useRoutesStore.getState().load()
  }, [])

  const route = store.routes.find((item) => item.id === routeId) ?? null
  const waypoints = useMemo(
    () => routeWaypointsForRoute(routeId, store.waypoints),
    [routeId, store.waypoints],
  )
  const annotations = useMemo(
    () => routeAnnotationsForRoute(routeId, store.annotations),
    [routeId, store.annotations],
  )

  useEffect(() => {
    if (!store.booted) return
    if (!route) {
      void navigate({ to: '/routes' })
    }
  }, [store.booted, route, navigate])

  const cover = route ? routeDetailCoverDisplay(route) : null
  const wantsAutoMapCover = store.autoMapCoverRouteIds.includes(routeId)
  const hasWaypoints = waypoints.length > 0

  const saveMapAsCover = useCallback(async () => {
    const coverPhotoDataUrl = await mapRef.current?.captureMapSnapshot()
    if (!coverPhotoDataUrl) {
      throw new Error('Could not capture the map')
    }
    await useRoutesStore.getState().updateRoute(routeId, {
      coverKind: 'map',
      coverPhotoDataUrl,
    })
    useRoutesStore.getState().clearAutoMapCoverRequest(routeId)
  }, [routeId])

  const tryAutoMapCover = useCallback(
    async (options?: { force?: boolean }) => {
      const currentRoute = useRoutesStore.getState().routes.find((item) => item.id === routeId)
      if (currentRoute?.coverPhotoDataUrl && !options?.force) {
        useRoutesStore.getState().clearAutoMapCoverRequest(routeId)
        return true
      }
      if (!options?.force && autoMapCoverAttemptedRef.current === routeId) {
        return false
      }
      if (!hasWaypoints) return false

      try {
        await saveMapAsCover()
        autoMapCoverAttemptedRef.current = routeId
        return true
      } catch {
        return false
      }
    },
    [hasWaypoints, routeId, saveMapAsCover],
  )

  const handleInitialMapViewportSettled = useCallback(() => {
    const wantsCover = useRoutesStore.getState().autoMapCoverRouteIds.includes(routeId)
    void tryAutoMapCover({ force: wantsCover })
  }, [routeId, tryAutoMapCover])

  const autoMapCoverDelays = useMemo(
    () => (wantsAutoMapCover ? [0, 800, 1500, 3000, 5000] : [0]),
    [wantsAutoMapCover],
  )

  useEffect(() => {
    autoMapCoverAttemptedRef.current = null
  }, [routeId])

  useEffect(() => {
    if (!route) return
    if (route.coverPhotoDataUrl && !wantsAutoMapCover) return
    if (!hasWaypoints && !wantsAutoMapCover) return

    const timers = autoMapCoverDelays.map((delay) =>
      window.setTimeout(() => {
        void tryAutoMapCover({ force: wantsAutoMapCover })
      }, delay),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [
    route,
    hasWaypoints,
    wantsAutoMapCover,
    tryAutoMapCover,
    routeId,
    autoMapCoverDelays,
  ])

  if (!store.booted || !route || !cover) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading route…</p>
      </main>
    )
  }

  const handleSaveRouteDetails = async (input: { title: string; description: string }) => {
    setBusy(true)
    try {
      await store.updateRoute(routeId, {
        title: input.title || 'Route',
        description: input.description || null,
      })
      toast.success('Route details updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update route details')
    } finally {
      setBusy(false)
    }
  }

  const handleUseCurrentMapCover = async () => {
    setCoverEditOpen(false)
    setBusy(true)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await saveMapAsCover()
      toast.success('Route cover updated from map')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to capture map cover')
    } finally {
      setBusy(false)
    }
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try {
      const coverPhotoDataUrl = await readImageFile(file)
      await store.updateRoute(routeId, { coverKind: 'photo', coverPhotoDataUrl })
      toast.success('Route photo updated')
      setCoverEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload photo')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleChooseMapCover = async () => {
    setBusy(true)
    try {
      await store.updateRoute(routeId, { coverKind: 'map' })
      toast.success('Route cover set to map')
      setCoverEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update cover')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveCover = async () => {
    setBusy(true)
    try {
      await store.updateRoute(routeId, { coverKind: null, coverPhotoDataUrl: null })
      toast.success('Route cover removed')
      setCoverEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove cover')
    } finally {
      setBusy(false)
    }
  }

  const handleChoosePhotoCover = () => {
    fileInputRef.current?.click()
  }

  const handleAddComment = async () => {
    if (!commentDraft.trim()) return
    setSubmitting(true)
    try {
      await store.addRouteComment(routeId, commentDraft, commentWaypointId)
      setCommentDraft('')
      setCommentWaypointId(null)
      toast.success('Comment added')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <DevComponentLabel name="RouteDetailPage" />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/routes"
            className="shrink-0 text-sm font-semibold text-[var(--brand)] no-underline"
          >
            Routes
          </Link>
          <span className="text-[var(--sea-ink-soft)]">/</span>
          <h1 className="m-0 truncate text-xl font-bold text-[var(--sea-ink)]">
            {route.title}
          </h1>
        </div>
        <RouteActionsMenu
          route={route}
          waypoints={waypoints}
          onDeleted={() => {
            void navigate({ to: '/routes' })
          }}
        />
      </div>

      <div className="relative mb-5 rounded-[1.5rem] bg-[var(--chip-bg)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[1.5rem]">
          <RouteMap
            ref={mapRef}
            route={route}
            waypoints={waypoints}
            className="absolute inset-0 size-full rounded-none"
            onInitialViewportSettled={handleInitialMapViewportSettled}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />

          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <TripMapChromeButton
              label="Edit route cover"
              onClick={() => setCoverEditOpen(true)}
              disabled={busy}
            >
              <Pencil className="size-4" />
            </TripMapChromeButton>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handlePhotoPick(event.target.files?.[0])}
      />

      <section className="space-y-4">
        <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-5">
          <h2 className="brand-title m-0 text-lg">Waypoints</h2>
          <ol className="mt-3 space-y-3">
            {waypoints.map((waypoint, index) => (
              <li
                key={waypoint.id}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                      {waypoint.name ?? `Waypoint ${index + 1}`}
                    </p>
                    {waypoint.description ? (
                      <p className="mt-1 mb-0 text-sm text-[var(--sea-ink-soft)]">
                        {waypoint.description}
                      </p>
                    ) : null}
                    <p className="mt-1 mb-0 text-xs text-[var(--sea-ink-soft)]">
                      {waypoint.latitude.toFixed(5)}, {waypoint.longitude.toFixed(5)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentWaypointId(waypoint.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--chip-line)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)]"
                  >
                    <MessageSquarePlus className="size-3.5" />
                    Comment
                  </button>
                </div>
                <WaypointComments
                  annotations={annotations.filter(
                    (annotation) => annotation.waypointId === waypoint.id,
                  )}
                />
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-5">
          <h2 className="brand-title m-0 text-lg">Route comments</h2>
          <WaypointComments
            annotations={annotations.filter((annotation) => !annotation.waypointId)}
          />

          <div className="mt-4 space-y-2">
            {commentWaypointId ? (
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Commenting on{' '}
                {waypoints.find((waypoint) => waypoint.id === commentWaypointId)?.name ??
                  'waypoint'}
                {' · '}
                <button
                  type="button"
                  className="font-semibold text-[var(--brand)]"
                  onClick={() => setCommentWaypointId(null)}
                >
                  Route instead
                </button>
              </p>
            ) : null}
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              rows={3}
              placeholder="Add a comment about this route…"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--sea-ink)]"
            />
            <button
              type="button"
              disabled={submitting || !commentDraft.trim()}
              onClick={() => void handleAddComment()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              <MessageSquarePlus className="size-4" />
              Add comment
            </button>
          </div>
        </div>
      </section>

      <RouteCoverEditModal
        open={coverEditOpen}
        busy={busy}
        cover={cover}
        title={route.title}
        description={route.description ?? ''}
        titlePlaceholder="Imported route"
        onClose={() => setCoverEditOpen(false)}
        onSaveDetails={(input) => void handleSaveRouteDetails(input)}
        onChoosePhoto={handleChoosePhotoCover}
        onChooseMap={() => void handleChooseMapCover()}
        onUseCurrentMap={() => void handleUseCurrentMapCover()}
        showUseCurrentMap={hasWaypoints}
        onRemoveCover={() => void handleRemoveCover()}
      />
    </main>
  )
}

function WaypointComments({ annotations }: { annotations: RouteAnnotation[] }) {
  if (annotations.length === 0) {
    return <p className="mt-2 mb-0 text-xs text-[var(--sea-ink-soft)]">No comments yet.</p>
  }

  return (
    <ul className="mt-2 space-y-1">
      {annotations.map((annotation) => (
        <li
          key={annotation.id}
          className="rounded-lg bg-[var(--chip-bg)] px-2.5 py-1.5 text-sm text-[var(--sea-ink)]"
        >
          {annotation.body}
        </li>
      ))}
    </ul>
  )
}

function RouteCard({
  route,
  waypoints,
  active,
  onSelect,
}: {
  route: Route
  waypoints: RouteWaypoint[]
  active: boolean
  onSelect: () => void
}) {
  const coverPhoto = routeCoverPhotoUrl(route)
  const coverKind = resolveRouteCoverKind(route)
  const subtitle = routeListSubtitle(route)
  const distanceLabel = formatRouteListDistanceMeters(
    routePlannedDistanceMeters(waypoints),
  )
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[1.4rem] border transition hover:-translate-y-[1px]',
        menuOpen && 'z-30',
        active
          ? 'border-[var(--active-border)] bg-[var(--active-panel)] shadow-sm'
          : 'border-[var(--panel-border)] bg-[var(--panel)]',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--chip-bg)]">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : coverKind === 'map' ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,var(--brand-muted),var(--chip-bg))] text-[var(--sea-ink-soft)]">
              <MapIcon className="size-8" strokeWidth={1.4} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Route map
              </span>
            </div>
          ) : (
            <div className="flex size-full items-center justify-center text-[var(--sea-ink-soft)]">
              <MapPin className="size-10" strokeWidth={1.5} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        <div className="space-y-2 px-4 pb-4 pt-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--kicker)]">
            Planned route
          </p>
          <h3 className="m-0 line-clamp-2 text-[1.15rem] font-bold leading-snug text-[var(--sea-ink)]">
            {route.title}
          </h3>
          <p className="m-0 line-clamp-3 text-sm leading-6 text-[var(--sea-ink-soft)]">
            {subtitle}
          </p>
          <p className="m-0 pt-1 text-sm font-medium text-[var(--sea-ink-soft)]">
            {formatRouteListWaypointCount(waypoints.length)}
            <StatSeparator />
            {distanceLabel}
            <StatSeparator />
            {formatRouteUpdatedLabel(route.updatedAt)}
          </p>
        </div>
      </button>

      <div className="absolute right-3 top-3 z-10">
        <RouteActionsMenu
          route={route}
          waypoints={waypoints}
          onOpenChange={setMenuOpen}
        />
      </div>
    </article>
  )
}

function StatSeparator() {
  return (
    <span aria-hidden="true" className="mx-2 text-[var(--line)]">
      ·
    </span>
  )
}

export function RoutesListPage() {
  const store = useRoutesStore()
  const navigate = useNavigate()
  const location = useLocation()
  const importRef = useRef<TripImportButtonHandle>(null)

  useEffect(() => {
    void useRoutesStore.getState().load()
  }, [])

  const openRoute = (routeId: string) => {
    store.selectRoute(routeId)
    void navigate({ to: '/routes/$routeId', params: { routeId } })
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <DevComponentLabel name="RoutesListPage" />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            Routes
          </h1>
          <Link
            to="/trips"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] no-underline"
          >
            <Sailboat className="size-4" />
            Trips
          </Link>
        </div>
        <TripImportButton
          ref={importRef}
          onRouteImported={(routeId) => openRoute(routeId)}
          onImported={(tripId) => {
            void navigate({ to: '/trips/$tripId', params: { tripId } })
          }}
        />
      </div>

      <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
        Planned paths and waypoint collections — separate from sailed trips.
      </p>

      {!store.booted ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">Loading routes…</p>
      ) : store.routes.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] text-[var(--sea-ink)]">
            <MapPin className="size-5" />
          </div>
          <h3 className="m-0 text-lg font-bold text-[var(--sea-ink)]">No routes yet</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--sea-ink-soft)]">
            Import a GPX file with waypoints or a planned route to create your first route.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {store.routes.map((route) => {
            const waypoints = routeWaypointsForRoute(route.id, store.waypoints)
            return (
              <RouteCard
                key={route.id}
                route={route}
                waypoints={waypoints}
                active={location.pathname === `/routes/${route.id}`}
                onSelect={() => openRoute(route.id)}
              />
            )
          })}
        </div>
      )}
    </main>
  )
}
