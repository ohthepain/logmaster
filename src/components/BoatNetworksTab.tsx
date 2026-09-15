import { Link } from '@tanstack/react-router'
import { Cable } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BoatNetworkDiagram } from '../domain/boat-network-diagram'
import { ASSET_CONNECTION_TYPE_LABELS } from '../domain/asset-connections'
import { fetchBoatNetworkDiagrams } from '../lib/boat-assets-api'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'
import { NetworkAddConnectionMenu } from './NetworkAddConnectionMenu'

type BoatNetworksTabProps = {
  boatId: string
}

function NetworkBackboneDiagram({
  boatId,
  diagram,
}: {
  boatId: string
  diagram: BoatNetworkDiagram
}) {
  const { devices } = diagram
  if (devices.length === 0) return null

  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-min px-2 pt-2">
        <div className="flex items-end gap-8 sm:gap-12">
          {devices.map((device) => (
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
                  {device.productImageUrl ? (
                    <img
                      src={device.productImageUrl}
                      alt=""
                      className="max-h-[4.5rem] max-w-full object-contain transition group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]">
                      <Cable className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                    </div>
                  )}
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
        </div>
        <div
          className="mx-2 mt-0 h-1 rounded-full bg-[var(--sea-ink)] opacity-70"
          role="img"
          aria-label={`${diagram.name} backbone`}
        />
      </div>
    </div>
  )
}

export function BoatNetworksTab({ boatId }: BoatNetworksTabProps) {
  const { t } = useTranslation()
  const [networks, setNetworks] = useState<BoatNetworkDiagram[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      {networks.map((diagram) => (
        <section
          key={diagram.networkAssetId}
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-4 sm:px-5"
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
          <NetworkBackboneDiagram boatId={boatId} diagram={diagram} />
        </section>
      ))}
    </div>
  )
}
