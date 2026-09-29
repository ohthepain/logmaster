import { useNavigate } from '@tanstack/react-router'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TripCrewUser } from '../domain/connections'
import type { Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { cn } from '../lib/cn'
import type { TripCrewInviteSummary } from '../lib/crew-api'
import { useTranslation } from '../lib/i18n'
import { APP_HEADER_TOP_OFFSET } from '../lib/safe-area'
import { tripDisplayName } from '../lib/trip-display'
import {
  formatTripListDistanceMeters,
  formatTripListDuration,
  tripDurationMs,
  tripTrackDistanceMeters,
} from '../lib/trip-list-stats'
import type { TripMapPackRecord } from '../lib/trip-map-pack'
import { formatByteSize, formatPackArea } from '../lib/trip-map-pack'
import { CrewAvatar } from './CrewAvatar'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

export type MapDownloadProgress = {
  done: number
  total: number
}

type TripActiveMenuProps = {
  open: boolean
  trip: Trip
  tracks: TripTrack[]
  crewPeople: TripCrewUser[]
  pendingInvites: TripCrewInviteSummary[]
  packs: TripMapPackRecord[]
  busy?: boolean
  uploading?: boolean
  downloading?: boolean
  downloadProgress?: MapDownloadProgress | null
  dismissDisabled?: boolean
  uploadInputId: string
  onClose: () => void
  onRename: (title: string) => void
  onAddCrew: () => void
  onCancelInvite: (inviteId: string) => void
  onDownload: () => void
  onDeletePack: (packId: string) => void
  onEditTrip: () => void
  onAddWaypoint?: () => void
  onEditWaypoints?: () => void
}

export function TripActiveMenu({
  open,
  trip,
  tracks,
  crewPeople,
  pendingInvites,
  packs,
  busy = false,
  uploading = false,
  downloading = false,
  downloadProgress = null,
  dismissDisabled = false,
  uploadInputId,
  onClose,
  onRename,
  onAddCrew,
  onCancelInvite,
  onDownload,
  onDeletePack,
  onEditTrip,
  onAddWaypoint,
  onEditWaypoints,
}: TripActiveMenuProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const ignoreNameBlur = useRef(false)

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const crew = crewPeople.filter((person) =>
    trip.crewUserIds?.includes(person.id),
  )
  const distance = formatTripListDistanceMeters(
    tripTrackDistanceMeters(trip.id, tracks),
  )
  const elapsed = formatTripListDuration(tripDurationMs(trip, now), {
    week: { one: t('weekCountOne'), other: t('weekCountOther') },
    day: { one: t('dayCountOne'), other: t('dayCountOther') },
  })

  const displayedName = tripDisplayName(trip)
  const startNameEdit = () => {
    ignoreNameBlur.current = false
    setNameDraft(displayedName)
    setEditingName(true)
  }
  const saveName = () => {
    if (ignoreNameBlur.current) return
    ignoreNameBlur.current = true
    const next = nameDraft.trim()
    setEditingName(false)
    const stored = trip.title?.trim() ?? ''
    if (next === stored || (next === displayedName && stored === '')) return
    onRename(next)
  }

  const run = (action: () => void) => {
    action()
    onClose()
  }

  return createPortal(
    <>
      {dismissDisabled ? null : <PopupOutsideDismiss onDismiss={onClose} />}
      <section
        role="dialog"
        aria-label={t('trip')}
        data-map-touch-zone
        className={cn(
          'map-chrome-surface ios-map-touch-target pointer-events-auto fixed left-1/2 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-2xl p-4',
          POPUP_MENU_Z_CLASS,
        )}
        style={{
          top: `calc(${APP_HEADER_TOP_OFFSET} + 0.5rem)`,
          maxHeight: 'min(32rem, calc(100dvh - 8rem))',
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              value={nameDraft}
              disabled={busy}
              aria-label={t('editTripName')}
              autoFocus
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  ignoreNameBlur.current = true
                  setEditingName(false)
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-[var(--map-chrome-border)] bg-transparent px-2 py-1 text-base font-semibold text-inherit outline-none"
            />
          ) : (
            <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">
              {displayedName}
            </h2>
          )}
          <button
            type="button"
            aria-label={t('editTripName')}
            disabled={busy}
            onMouseDown={(event) => {
              if (editingName) event.preventDefault()
            }}
            onClick={() => {
              if (editingName) saveName()
              else startNameEdit()
            }}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs opacity-70">{t('fieldDistance')}</dt>
            <dd className="m-0 font-semibold">{distance}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-70">{t('elapsed')}</dt>
            <dd className="m-0 font-semibold">{elapsed}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold">{t('crew')}</h3>
          <button
            type="button"
            aria-label={t('addCrew')}
            disabled={busy}
            onClick={onAddCrew}
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        {crew.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {crew.map((person) => (
              <li key={person.id} className="flex items-center gap-2">
                <CrewAvatar
                  name={person.name}
                  imageUrl={person.imageUrl}
                  userId={person.id}
                  className="size-8"
                />
                <span className="min-w-0 truncate">{person.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {pendingInvites.length ? (
          <ul className="mt-2 space-y-2 text-sm opacity-80">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CrewAvatar name={invite.email} className="size-8" />
                  <span className="min-w-0 truncate">{invite.email}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                  onClick={() => onCancelInvite(invite.id)}
                >
                  {t('cancel')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold">{t('downloadedMaps')}</h3>
          <button
            type="button"
            aria-label={t('downloadThisMap')}
            disabled={busy || downloading}
            onClick={onDownload}
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        {downloadProgress ? (
          <MapPackDownloadProgress
            done={downloadProgress.done}
            total={downloadProgress.total}
            label={t('downloadProgress', {
              done: String(downloadProgress.done),
              total: String(downloadProgress.total),
            })}
          />
        ) : null}
        {packs.length ? (
          <ul className="mt-2 space-y-2">
            {packs.map((pack) => (
              <li
                key={pack.id}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <span>
                  <span className="block">{formatPackArea(pack)}</span>
                  <span className="block text-xs opacity-70">
                    {t('mapPackZoom', {
                      min: String(pack.zMin),
                      max: String(pack.zMax),
                    })}
                    {' · '}
                    {formatByteSize(pack.byteSize)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t('deleteDownloadedMap')}
                  disabled={busy}
                  onClick={() => onDeletePack(pack.id)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-0 mt-2 text-sm opacity-70">
            {t('noDownloadedMaps')}
          </p>
        )}

        <div className="mt-4 border-t border-[var(--map-chrome-border)] pt-2">
          <label
            htmlFor={busy || uploading ? undefined : uploadInputId}
            onClick={() => {
              if (busy || uploading) return
              window.setTimeout(() => onClose(), 0)
            }}
            className={cn(
              'block w-full cursor-pointer rounded-lg px-1 py-2 text-left text-sm font-medium hover:bg-[var(--map-chrome-hover)]',
              (busy || uploading) && 'pointer-events-none opacity-60',
            )}
          >
            {uploading ? t('uploading') : t('uploadPhotosAndVideo')}
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => {
                void navigate({
                  to: '/trips/$tripId/story/edit',
                  params: { tripId: trip.id },
                })
              })
            }
            className="block w-full rounded-lg px-1 py-2 text-left text-sm font-medium hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
          >
            {t('trackStories')}
          </button>
          {onAddWaypoint ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(onAddWaypoint)}
              className="block w-full rounded-lg px-1 py-2 text-left text-sm font-medium hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
            >
              {t('addWaypoint')}
            </button>
          ) : null}
          {onEditWaypoints ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(onEditWaypoints)}
              className="block w-full rounded-lg px-1 py-2 text-left text-sm font-medium hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
            >
              {t('editWaypoints')}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onEditTrip)}
            className="block w-full rounded-lg px-1 py-2 text-left text-sm font-medium hover:bg-[var(--map-chrome-hover)] disabled:opacity-60"
          >
            {t('editTripCover')}
          </button>
        </div>
      </section>
    </>,
    document.body,
  )
}

export function MapPackDownloadProgress({
  done,
  total,
  label,
}: {
  done: number
  total: number
  label: string
}) {
  return (
    <div className="mt-2">
      <p className="m-0 text-sm font-semibold tabular-nums">{label}</p>
      <progress
        className="mt-1 h-2 w-full accent-[var(--sea-ink)]"
        max={Math.max(total, 1)}
        value={Math.min(done, Math.max(total, 1))}
        aria-label={label}
      />
    </div>
  )
}

export function TripMapDownloadButton({
  label,
  disabled,
  progress,
  onClick,
}: {
  label: string
  disabled?: boolean
  progress?: MapDownloadProgress | null
  onClick: () => void
}) {
  const progressLabel = progress ? `${progress.done} / ${progress.total}` : null
  return (
    <button
      type="button"
      data-map-touch-zone
      aria-label={progressLabel ? `${label}, ${progressLabel}` : label}
      title={progressLabel ?? label}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'map-chrome-surface ios-map-touch-target pointer-events-auto inline-flex h-10 touch-manipulation items-center justify-center gap-2 rounded-full transition hover:bg-[var(--map-chrome-hover)] disabled:opacity-60',
        progress ? 'px-3' : 'size-10',
      )}
    >
      <Download className="size-4 shrink-0" aria-hidden />
      {progress ? (
        <span className="text-xs font-semibold tabular-nums">
          {progressLabel}
        </span>
      ) : null}
    </button>
  )
}
