import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Map as MapIcon,
  MapPin,
  MapPinPlus,
  MessageSquarePlus,
  Pencil,
  Plus,
  Sailboat,
  Trash2,
} from 'lucide-react'
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
import type { MapLngLat } from '../lib/logbook-map-geo'
import type { MapWaypointPickConfig } from '../lib/map-waypoint-pick'
import { DevComponentLabel } from './DevComponentLabel'
import { RouteActionsMenu } from './RouteActionsMenu'
import { RouteCoverEditModal } from './RouteCoverEditModal'
import { RouteMap } from './RouteMap'
import { RouteWaypointComposerModal } from './RouteWaypointComposerModal'
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
  const [waypointComposerOpen, setWaypointComposerOpen] = useState(false)
  const [waypointPickActive, setWaypointPickActive] = useState(false)
  const [waypointPickBusy, setWaypointPickBusy] = useState(false)
  const [editingWaypoint, setEditingWaypoint] = useState<RouteWaypoint | null>(null)
  const [draftMapPosition, setDraftMapPosition] = useState<MapLngLat | null>(null)

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

  const startWaypointPick = useCallback(() => {
    setWaypointPickActive(true)
  }, [])

  const waypointPick = useMemo<MapWaypointPickConfig | null>(
    () =>
      waypointPickActive
        ? {
            phase: 'add',
            busy: waypointPickBusy,
            onCancel: () => {
              setWaypointPickActive(false)
            },
            onConfirm: async (position) => {
              setWaypointPickBusy(true)
              try {
                await store.addRouteWaypoint(routeId, {
                  latitude: position.latitude,
                  longitude: position.longitude,
                })
                toast.success('Waypoint added')
                setWaypointPickActive(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not save waypoint')
              } finally {
                setWaypointPickBusy(false)
              }
            },
          }
        : null,
    [routeId, store, waypointPickActive, waypointPickBusy],
  )

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

  const openWaypointComposer = (waypoint: RouteWaypoint) => {
    setEditingWaypoint(waypoint)
    setDraftMapPosition({
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
    })
    setWaypointComposerOpen(true)
  }

  const closeWaypointComposer = () => {
    setWaypointComposerOpen(false)
    setEditingWaypoint(null)
    setDraftMapPosition(null)
  }

  const handleDeleteWaypoint = async (waypointId: string) => {
    if (!window.confirm('Delete this waypoint?')) return
    try {
      await store.deleteRouteWaypointById(waypointId)
      toast.success('Waypoint deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete waypoint')
    }
  }

  const moveWaypoint = async (waypointId: string, direction: 'up' | 'down') => {
    const index = waypoints.findIndex((waypoint) => waypoint.id === waypointId)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= waypoints.length) return

    const orderedIds = waypoints.map((waypoint) => waypoint.id)
    ;[orderedIds[index], orderedIds[targetIndex]] = [
      orderedIds[targetIndex]!,
      orderedIds[index]!,
    ]

    try {
      await store.reorderRouteWaypoints(routeId, orderedIds)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reorder waypoints')
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
            waypointPick={waypointPick ?? undefined}
            onWaypointClick={(waypointId) => {
              const waypoint = waypoints.find((item) => item.id === waypointId)
              if (waypoint) openWaypointComposer(waypoint)
            }}
            onInitialViewportSettled={handleInitialMapViewportSettled}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />

          {!waypointPickActive ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
            <TripMapChromeButton
              label="Edit route cover"
              onClick={() => setCoverEditOpen(true)}
              disabled={busy}
            >
              <Pencil className="size-4" />
            </TripMapChromeButton>
            <TripMapChromeButton
              label="Add waypoint on map"
              onClick={() => startWaypointPick()}
            >
              <MapPinPlus className="size-4" />
            </TripMapChromeButton>
          </div>
          ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="brand-title m-0 text-lg">Waypoints</h2>
            <button
              type="button"
              onClick={() => startWaypointPick()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)]"
            >
              <Plus className="size-3.5" />
              Add waypoint
            </button>
          </div>
          {waypoints.length === 0 ? (
            <p className="mt-3 mb-0 text-sm text-[var(--sea-ink-soft)]">
              No waypoints yet. Add one manually or tap the map pin control above.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {waypoints.map((waypoint, index) => (
                <li
                  key={waypoint.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                        <button
                          type="button"
                          aria-label="Move waypoint up"
                          disabled={index === 0}
                          onClick={() => void moveWaypoint(waypoint.id, 'up')}
                          className="rounded p-0.5 text-[var(--sea-ink-soft)] disabled:opacity-30"
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <GripVertical className="mx-auto size-4 text-[var(--sea-ink-soft)]" />
                        <button
                          type="button"
                          aria-label="Move waypoint down"
                          disabled={index === waypoints.length - 1}
                          onClick={() => void moveWaypoint(waypoint.id, 'down')}
                          className="rounded p-0.5 text-[var(--sea-ink-soft)] disabled:opacity-30"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>
                      <div className="min-w-0">
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
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => openWaypointComposer(waypoint)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)]"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentWaypointId(waypoint.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)]"
                      >
                        <MessageSquarePlus className="size-3.5" />
                        Comment
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteWaypoint(waypoint.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <WaypointComments
                    annotations={annotations.filter(
                      (annotation) => annotation.waypointId === waypoint.id,
                    )}
                  />
                </li>
              ))}
            </ol>
          )}
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

      <RouteWaypointComposerModal
        open={waypointComposerOpen && editingWaypoint !== null}
        routeId={routeId}
        waypoint={editingWaypoint}
        initialPosition={draftMapPosition}
        onClose={closeWaypointComposer}
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

  const handleCreateRoute = async () => {
    try {
      const route = await store.createRoute()
      openRoute(route.id)
      toast.success('Route created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create route')
    }
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCreateRoute()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--btn-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Plus className="size-4" />
            New route
          </button>
          <TripImportButton
            ref={importRef}
            onRouteImported={(routeId) => openRoute(routeId)}
            onImported={(tripId) => {
              void navigate({ to: '/trips/$tripId', params: { tripId } })
            }}
          />
        </div>
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
            Create a route and add waypoints on the map, or import a GPX file with a planned path.
          </p>
          <button
            type="button"
            onClick={() => void handleCreateRoute()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Plus className="size-4" />
            New route
          </button>
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
