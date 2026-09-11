import { ChevronDown } from 'lucide-react'
import { NotificationPreferenceBell } from './NotificationPreferenceBell'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { Trip } from '../domain/logbook'
import type { NotificationPreferenceNode } from '../domain/notification-preferences'
import {
  NOTIFICATION_PREFERENCE_PATH_LABELS,
  TRIP_PREFERENCE_SECTIONS,
  boatSectionPaths,
  orgSectionPaths,
  partitionTripsForNotificationSettings,
  tripDisplayTitle,
} from '../domain/notification-preferences'
import { updateNotificationPreferenceMute } from '../lib/notifications-api'
import {
  ensureNotificationPreferencesReady,
  useNotificationPreferencesStore,
} from '../stores/notification-preferences'
import { useLogbookStore } from '../stores/logbook'
import { cn } from '../lib/cn'

type NotificationSettingsPanelProps = {
  className?: string
}

function nodesByPath(
  nodes: NotificationPreferenceNode[],
): Map<string, NotificationPreferenceNode> {
  return new Map(nodes.map((node) => [node.path, node]))
}

export function NotificationPreferenceToggleRow({
  node,
  busy,
  onToggle,
  indent = 0,
  titleOverride,
}: {
  node: NotificationPreferenceNode
  busy: boolean
  onToggle: (path: string, muted: boolean) => void
  indent?: number
  titleOverride?: string
}) {
  const enabled = !node.muted
  const rowLabel =
    titleOverride ??
    NOTIFICATION_PREFERENCE_PATH_LABELS[node.path] ??
    node.label ??
    node.path

  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3',
        indent > 0 && 'ml-3',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-[var(--sea-ink)]">{rowLabel}</p>
        {!node.effective && node.blockedByLabel ? (
          <p className="mt-1 mb-0 text-xs leading-5 text-amber-700 dark:text-amber-300">
            Blocked by &ldquo;{node.blockedByLabel}&rdquo; until that level is
            unmuted.
          </p>
        ) : null}
      </div>
      <NotificationPreferenceBell
        node={node}
        busy={busy}
        onToggle={onToggle}
        label={
          titleOverride
            ? enabled
              ? `Mute ${titleOverride}`
              : `Unmute ${titleOverride}`
            : undefined
        }
      />
    </div>
  )
}

function SettingsAccordion({
  title,
  categoryPath,
  categoryNode,
  busyPath,
  onToggle,
  defaultOpen = false,
  children,
}: {
  title: string
  categoryPath: string
  categoryNode: NotificationPreferenceNode | undefined
  busyPath: string | null
  onToggle: (path: string, currentlyEnabled: boolean) => void
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)]">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              'size-5 shrink-0 text-[var(--sea-ink-soft)] transition',
              open && 'rotate-180',
            )}
            aria-hidden
          />
          <span className="text-base font-semibold text-[var(--sea-ink)]">
            {title}
          </span>
        </button>
        {categoryNode ? (
          <NotificationPreferenceBell
            node={categoryNode}
            busy={busyPath === categoryPath}
            onToggle={onToggle}
            label={
              !categoryNode.muted
                ? `Mute all ${title}`
                : `Unmute all ${title}`
            }
          />
        ) : null}
      </div>
      {open ? <div className="flex flex-col gap-2 p-3">{children}</div> : null}
    </div>
  )
}

function placeholderNode(path: string, label: string): NotificationPreferenceNode {
  return {
    path,
    label,
    muted: false,
    effective: true,
    blockedBy: null,
    blockedByLabel: null,
  }
}

function ActiveTripBlock({
  trip,
  nodeMap,
  busyPath,
  onToggle,
}: {
  trip: Trip
  nodeMap: Map<string, NotificationPreferenceNode>
  busyPath: string | null
  onToggle: (path: string, currentlyEnabled: boolean) => void
}) {
  const instancePath = `trip:${trip.id}`
  const instanceNode =
    nodeMap.get(instancePath) ??
    placeholderNode(instancePath, tripDisplayTitle(trip))

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] p-3">
      <div className="mb-2 px-1">
        <p className="m-0 text-base font-bold text-[var(--sea-ink)]">
          {tripDisplayTitle(trip)}
        </p>
        <p className="m-0 mt-0.5 text-xs font-medium text-[var(--brand)]">
          In progress
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <NotificationPreferenceToggleRow
          node={{ ...instanceNode, label: 'All activity on this trip' }}
          busy={busyPath === instancePath}
          onToggle={onToggle}
        />
        {TRIP_PREFERENCE_SECTIONS.map((section) => {
          const path = `trip:${trip.id}:${section}`
          const node =
            nodeMap.get(path) ??
            placeholderNode(
              path,
              NOTIFICATION_PREFERENCE_PATH_LABELS[section] ?? section,
            )
          return (
            <NotificationPreferenceToggleRow
              key={path}
              node={node}
              busy={busyPath === path}
              onToggle={onToggle}
              indent={1}
            />
          )
        })}
      </div>
    </div>
  )
}

export function NotificationSettingsPanel({
  className,
}: NotificationSettingsPanelProps) {
  const trips = useLogbookStore((state) => state.trips)
  const tree = useNotificationPreferencesStore((state) => state.tree)
  const loading = useNotificationPreferencesStore((state) => state.loading)
  const loadError = useNotificationPreferencesStore((state) => state.error)
  const [busyPath, setBusyPath] = useState<string | null>(null)

  const { inProgress, completed } = useMemo(
    () => partitionTripsForNotificationSettings(trips),
    [trips],
  )

  const nodes = tree?.nodes ?? []
  const resources = tree?.resources ?? { boats: [], orgs: [] }
  const nodeMap = useMemo(() => nodesByPath(nodes), [nodes])

  useEffect(() => {
    void ensureNotificationPreferencesReady().catch((error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to load notification settings',
      )
    })
  }, [])

  useEffect(() => {
    if (loadError) {
      toast.error(loadError)
    }
  }, [loadError])

  const toggle = async (path: string, currentlyEnabled: boolean) => {
    const nextMuted = currentlyEnabled
    setBusyPath(path)
    try {
      const result = await updateNotificationPreferenceMute({
        path,
        muted: nextMuted,
      })
      useNotificationPreferencesStore.getState().patchNode(result.node)
      if (!nextMuted && !result.effective && result.blockedByLabel) {
        toast.warning(
          `Preference saved, but notifications stay off until you unmute “${result.blockedByLabel}”.`,
        )
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update notification settings',
      )
    } finally {
      setBusyPath(null)
    }
  }

  if (loading && !tree) {
    return (
      <p className={cn('text-sm text-[var(--sea-ink-soft)]', className)}>
        Loading notification settings…
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {inProgress.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Active trips
          </p>
          {inProgress.map((trip) => (
            <ActiveTripBlock
              key={trip.id}
              trip={trip}
              nodeMap={nodeMap}
              busyPath={busyPath}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : null}

      <SettingsAccordion
        title="Boats"
        categoryPath="boat"
        categoryNode={nodeMap.get('boat')}
        busyPath={busyPath}
        onToggle={toggle}
        defaultOpen={resources.boats.length <= 1}
      >
        {resources.boats.length === 0 ? (
          <p className="m-0 px-1 text-sm text-[var(--sea-ink-soft)]">
            No boats yet.
          </p>
        ) : (
          resources.boats.map((boat) => (
            <div key={boat.id} className="flex flex-col gap-2">
              <p className="m-0 px-1 text-sm font-semibold text-[var(--sea-ink)]">
                {boat.name}
              </p>
              {[`boat:${boat.id}`, ...boatSectionPaths(boat.id)].map((path) => {
                const node = nodeMap.get(path)
                if (!node) return null
                return (
                  <NotificationPreferenceToggleRow
                    key={path}
                    node={node}
                    busy={busyPath === path}
                    onToggle={toggle}
                    indent={path.split(':').length > 2 ? 1 : 0}
                  />
                )
              })}
            </div>
          ))
        )}
      </SettingsAccordion>

      {resources.orgs.length > 0 ? (
        <SettingsAccordion
          title="Organizations"
          categoryPath="org"
          categoryNode={nodeMap.get('org')}
          busyPath={busyPath}
          onToggle={toggle}
          defaultOpen={resources.orgs.length <= 1}
        >
          {resources.orgs.map((org) => (
            <div key={org.id} className="flex flex-col gap-2">
              <p className="m-0 px-1 text-sm font-semibold text-[var(--sea-ink)]">
                {org.name}
              </p>
              {[`org:${org.id}`, ...orgSectionPaths(org.id)].map((path) => {
                const node = nodeMap.get(path)
                if (!node) return null
                return (
                  <NotificationPreferenceToggleRow
                    key={path}
                    node={node}
                    busy={busyPath === path}
                    onToggle={toggle}
                    indent={path.split(':').length > 2 ? 1 : 0}
                  />
                )
              })}
            </div>
          ))}
        </SettingsAccordion>
      ) : null}

      {completed.length > 0 ? (
        <SettingsAccordion
          title="Trips"
          categoryPath="trip"
          categoryNode={nodeMap.get('trip')}
          busyPath={busyPath}
          onToggle={toggle}
        >
          {completed.map((trip) => {
            const instancePath = `trip:${trip.id}`
            const instanceNode =
              nodeMap.get(instancePath) ??
              placeholderNode(instancePath, tripDisplayTitle(trip))
            return (
              <div key={trip.id} className="flex flex-col gap-2">
                <NotificationPreferenceToggleRow
                  node={{
                    ...instanceNode,
                    label: tripDisplayTitle(trip),
                  }}
                  busy={busyPath === instancePath}
                  onToggle={toggle}
                />
                {TRIP_PREFERENCE_SECTIONS.map((section) => {
                  const path = `trip:${trip.id}:${section}`
                  const node = nodeMap.get(path)
                  if (!node) return null
                  return (
                    <NotificationPreferenceToggleRow
                      key={path}
                      node={node}
                      busy={busyPath === path}
                      onToggle={toggle}
                      indent={1}
                    />
                  )
                })}
              </div>
            )
          })}
        </SettingsAccordion>
      ) : null}

      {nodeMap.get('job') ? (
        <NotificationPreferenceToggleRow
          node={nodeMap.get('job')!}
          busy={busyPath === 'job'}
          onToggle={toggle}
        />
      ) : null}
    </div>
  )
}
