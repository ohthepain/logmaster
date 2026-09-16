import { Link } from '@tanstack/react-router'
import { Cable } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { BoatNetworkDiagram } from '../domain/boat-network-diagram'
import type { BoatNetworkPossibleDevice } from '../domain/boat-network-graph'
import { ASSET_CONNECTION_TYPE_LABELS } from '../domain/asset-connections'
import type { BoatNetworkKey } from '../domain/asset-connections'
import {
  createNetworkEquipmentConnection,
  fetchBoatNetworkDiagrams,
} from '../lib/boat-assets-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'
import { NetworkAddConnectionMenu } from './NetworkAddConnectionMenu'

type BoatNetworksTabProps = {
  boatId: string
  focusNetworkKey?: BoatNetworkKey
}

function DeviceIcon({
  name,
  productImageUrl,
}: {
  name: string
  productImageUrl: string | null
}) {
  if (productImageUrl) {
    return (
      <img
        src={productImageUrl}
        alt={name}
        className="max-h-[4.5rem] max-w-full object-contain transition group-hover:opacity-90"
      />
    )
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]">
      <Cable className="h-7 w-7" strokeWidth={1.5} aria-hidden />
    </div>
  )
}

function NetworkBackboneDiagram({
  boatId,
  diagram,
  showPossible,
  connectingId,
  onConnect,
}: {
  boatId: string
  diagram: BoatNetworkDiagram
  showPossible: boolean
  connectingId: string | null
  onConnect: (networkAssetId: string, equipmentAssetId: string) => void
}) {
  const { t } = useTranslation()
  const hasActual = diagram.devices.length > 0
  const possible = showPossible ? diagram.possibleDevices : []

  if (!hasActual && !possible.length && !diagram.linkedNetworks.length) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        {t('assetConnectionsEmpty')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {diagram.linkedNetworks.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            {t('boatNetworkLinkedNetworks')}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2 list-none p-0">
            {diagram.linkedNetworks.map((link) => (
              <li key={link.connectionId}>
                <Link
                  to="/boats/$boatId"
                  params={{ boatId }}
                  search={{ tab: 'networks' }}
                  className="inline-flex items-center rounded-full border border-[var(--sea-ink)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)] no-underline"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasActual || possible.length ? (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-min px-2 pt-2">
            <div className="flex items-end gap-8 sm:gap-12">
              {diagram.devices.map((device) => (
                <div
                  key={device.assetId}
                  className="flex w-24 shrink-0 flex-col items-center sm:w-28"
                >
                  <Link
                    to="/boats/$boatId/assets/$assetId"
                    params={{ boatId, assetId: device.assetId }}
                    className="group flex w-full flex-col items-center no-underline"
                  >
                    <div className="flex h-[4.5rem] w-full items-center justify-center">
                      <DeviceIcon
                        name={device.name}
                        productImageUrl={device.productImageUrl}
                      />
                    </div>
                    <span className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-snug text-[var(--sea-ink)] group-hover:underline">
                      {device.name}
                    </span>
                    <span className="mt-0.5 text-center text-[10px] text-[var(--sea-ink-soft)]">
                      {ASSET_CONNECTION_TYPE_LABELS[device.connectionType]}
                    </span>
                  </Link>
                  <div
                    className="mt-2 h-8 w-0.5 shrink-0 bg-[var(--line)]"
                    aria-hidden
                  />
                </div>
              ))}
              {possible.map((device) => (
                <PossibleDeviceNode
                  key={device.assetId}
                  boatId={boatId}
                  device={device}
                  networkAssetId={diagram.networkAssetId}
                  busy={connectingId === device.assetId}
                  onConnect={onConnect}
                />
              ))}
            </div>
            <div
              className="mx-2 mt-0 h-1 rounded-full bg-[var(--sea-ink)] opacity-70"
              role="img"
              aria-label={`${diagram.name} backbone`}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PossibleDeviceNode({
  boatId,
  device,
  networkAssetId,
  busy,
  onConnect,
}: {
  boatId: string
  device: BoatNetworkPossibleDevice
  networkAssetId: string
  busy: boolean
  onConnect: (networkAssetId: string, equipmentAssetId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex w-28 shrink-0 flex-col items-center sm:w-32">
      <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-[var(--sea-ink-soft)] p-2">
        <Link
          to="/boats/$boatId/assets/$assetId"
          params={{ boatId, assetId: device.assetId }}
          className="group flex w-full flex-col items-center no-underline"
        >
          <div className="flex h-[4.5rem] w-full items-center justify-center opacity-80">
            <DeviceIcon name={device.name} productImageUrl={null} />
          </div>
          <span className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-snug text-[var(--sea-ink-soft)] group-hover:underline">
            {device.name}
          </span>
        </Link>
        {device.via === 'linked_network' && device.viaNetworkName ? (
          <span className="mt-1 text-center text-[10px] text-[var(--sea-ink-soft)]">
            {t('boatNetworkPossibleVia', { network: device.viaNetworkName })}
          </span>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="mt-2 rounded-full border border-[var(--chip-line)] px-3 py-1 text-[10px] font-semibold disabled:opacity-50"
          onClick={() => onConnect(networkAssetId, device.assetId)}
        >
          {busy ? t('saving') : t('boatNetworkConnectDevice')}
        </button>
      </div>
      <div
        className="mt-2 h-8 w-0 border-l-2 border-dashed border-[var(--sea-ink-soft)]"
        aria-hidden
      />
    </div>
  )
}

export function BoatNetworksTab({
  boatId,
  focusNetworkKey,
}: BoatNetworksTabProps) {
  const { t } = useTranslation()
  const [networks, setNetworks] = useState<BoatNetworkDiagram[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPossible, setShowPossible] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (opts?.background) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await fetchBoatNetworkDiagrams(boatId)
        setNetworks(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load networks')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [boatId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!focusNetworkKey || loading) return
    const node = document.getElementById(`boat-network-${focusNetworkKey}`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusNetworkKey, loading, networks])

  async function connectPossible(
    networkAssetId: string,
    equipmentAssetId: string,
  ) {
    setConnectingId(equipmentAssetId)
    try {
      await createNetworkEquipmentConnection(
        boatId,
        networkAssetId,
        equipmentAssetId,
      )
      await load({ background: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Please retry.')
    } finally {
      setConnectingId(null)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">{t('loadingBoat')}</p>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {error}
        <button
          type="button"
          className="ml-3 font-semibold underline"
          onClick={() => void load()}
        >
          {t('refresh')}
        </button>
      </div>
    )
  }

  if (networks.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-8 text-center">
        <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
          {t('boatNetworksEmpty')}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--sea-ink-soft)]">
          {t('boatNetworksEmptyHelp')}
        </p>
        <Link
          to="/boats/$boatId"
          params={{ boatId }}
          search={{ tab: 'assets' }}
          className="mt-4 inline-block text-sm font-semibold text-[var(--sea-ink)]"
        >
          {t('assets')} →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ResourceSectionHeader
        title={t('networks')}
        topic="BOAT_ASSETS"
        boatId={boatId}
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
      />
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
        <input
          type="checkbox"
          className="size-4 accent-[var(--sea-ink)]"
          checked={showPossible}
          onChange={(event) => setShowPossible(event.target.checked)}
        />
        {t('possibleConnections')}
      </label>
      <p className="-mt-6 text-sm text-[var(--sea-ink-soft)]">
        {t('possibleConnectionsHint')}
      </p>
      {networks.map((diagram) => (
        <section
          key={diagram.networkAssetId}
          id={`boat-network-${diagram.networkKey}`}
          className={cn(
            'rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-4 sm:px-5',
            focusNetworkKey === diagram.networkKey &&
              'ring-2 ring-[var(--sea-ink)] ring-offset-2 ring-offset-[var(--bg-base)]',
          )}
        >
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
              {diagram.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <NetworkAddConnectionMenu
                boatId={boatId}
                diagram={diagram}
                onConnected={() => void load({ background: true })}
              />
              <Link
                to="/boats/$boatId/assets/$assetId"
                params={{ boatId, assetId: diagram.networkAssetId }}
                className="text-xs font-semibold text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)] hover:underline"
              >
                {t('boatNetworkDetails')}
              </Link>
            </div>
          </div>
          <NetworkBackboneDiagram
            boatId={boatId}
            diagram={diagram}
            showPossible={showPossible}
            connectingId={connectingId}
            onConnect={(networkAssetId, equipmentAssetId) =>
              void connectPossible(networkAssetId, equipmentAssetId)
            }
          />
        </section>
      ))}
    </div>
  )
}
