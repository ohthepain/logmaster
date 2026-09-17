import { AssetBrandLogo } from './AssetBrandLogo'
import { getAssetIdentity } from '../domain/asset-brands'
import { Link, useNavigate } from '@tanstack/react-router'
import { Cable } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AddAssetModal } from './AddAssetModal'
import { AssetCoverPhoto } from './AssetCoverPhoto'
import { BoatNetworkSoapBars } from './BoatNetworkSoapBar'
import {
  connectedBoatNetworks,
  listedBoatNetworks,
} from '../domain/asset-connections'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import type { BoatAsset } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'
import { fetchBoatAssets } from '../lib/boat-assets-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import {
  ResourceAddButton,
  ResourceSectionHeader,
} from './NotificationBellToggle'

type BoatAssetsTabProps = {
  boatId: string
  boatName: string
  orgName: string | null
  members: ResourceMember[]
}

type AssetModalState = { mode: 'closed' } | { mode: 'create' }

const BOAT_RESOURCE_CARD_GRID =
  'grid grid-cols-1 gap-3 landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export function BoatAssetsTab({
  boatId,
  boatName,
  orgName,
  members,
}: BoatAssetsTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<BoatAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assetModal, setAssetModal] = useState<AssetModalState>({
    mode: 'closed',
  })
  const [categoryFilter, setCategoryFilter] = useState('All')
  const equipmentAssets = useMemo(
    () => assets.filter((asset) => asset.kind !== 'system_network'),
    [assets],
  )
  const networkSoapBars = useMemo(() => listedBoatNetworks(assets), [assets])
  const visibleAssets = equipmentAssets.filter(
    (asset) =>
      categoryFilter === 'All' ||
      (asset.category ?? 'Uncategorized') === categoryFilter,
  )

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (opts?.background) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await fetchBoatAssets(boatId)
        setAssets(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load assets')
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
    return <p className="text-sm text-[var(--sea-ink-soft)]">Loading assets…</p>
  }

  if (error) {
    return (
      <div>
        <ResourceSectionHeader
          title={t('assets')}
          topic="BOAT_ASSETS"
          boatId={boatId}
          titleExtras={
            <BoatNetworkSoapBars boatId={boatId} networks={networkSoapBars} />
          }
          onRefresh={() => load()}
          refreshing={refreshing}
        />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      <ResourceSectionHeader
        title={t('assets')}
        topic="BOAT_ASSETS"
        boatId={boatId}
        titleExtras={
          <BoatNetworkSoapBars boatId={boatId} networks={networkSoapBars} />
        }
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
        actions={
          <ResourceAddButton
            label={t('addAsset')}
            onClick={() => setAssetModal({ mode: 'create' })}
          />
        }
      />

      <div
        role="group"
        aria-label="Filter assets by category"
        className="mb-4 flex flex-wrap gap-2"
      >
        {['All', ...ASSET_CATEGORIES, 'Uncategorized'].map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={categoryFilter === category}
            onClick={() => setCategoryFilter(category)}
            className={cn(
              'shrink-0 rounded-full border border-[var(--chip-line)] px-3 py-2 text-xs font-semibold',
              categoryFilter === category
                ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                : 'bg-[var(--chip-bg)]',
            )}
          >
            {category} (
            {
              equipmentAssets.filter(
                (asset) =>
                  category === 'All' ||
                  (asset.category ?? 'Uncategorized') === category,
              ).length
            }
            )
          </button>
        ))}
      </div>

      {visibleAssets.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          {equipmentAssets.length
            ? 'No assets in this category.'
            : 'No assets recorded yet.'}
        </p>
      ) : (
        <ul className={cn('m-0 list-none p-0', BOAT_RESOURCE_CARD_GRID)}>
          {visibleAssets.map((asset) => {
            const identity = getAssetIdentity(asset)
            const hasCover = Boolean(asset.coverPhoto || asset.productImageUrl)
            return (
              <li key={asset.id}>
                <Link
                  to="/boats/$boatId/assets/$assetId"
                  params={{ boatId, assetId: asset.id }}
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] no-underline transition hover:border-[var(--btn-bg)] hover:bg-[var(--chip-bg)]"
                >
                  <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--chip-bg)]">
                    {hasCover ? (
                      <AssetCoverPhoto
                        cover={asset.coverPhoto}
                        productImageUrl={asset.productImageUrl}
                        alt={identity.title}
                        variant="card"
                        className="size-full"
                      />
                    ) : (
                      <Cable
                        className="size-10 text-[var(--sea-ink-soft)]"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <AssetBrandLogo brand={identity.brand} />
                    <p className="m-0 mt-2 line-clamp-2 text-base font-semibold leading-snug text-[var(--sea-ink)]">
                      {identity.title}
                    </p>
                    {identity.subtitle ? (
                      <p className="m-0 mt-1 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
                        {identity.subtitle}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)]">
                        {asset.ownerLabel}
                      </span>
                      <BoatNetworkSoapBars
                        boatId={boatId}
                        networks={connectedBoatNetworks(asset.connections)}
                      />
                      <span className="text-[10px] text-[var(--sea-ink-soft)]">
                        {asset.category ?? 'Uncategorized'}
                      </span>
                    </div>
                    {asset.description &&
                    asset.description !== identity.productName ? (
                      <p className="mt-2 mb-0 line-clamp-2 text-xs text-[var(--sea-ink-soft)]">
                        {asset.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {assetModal.mode === 'create' && (
        <AddAssetModal
          boatId={boatId}
          boatName={boatName}
          orgName={orgName}
          members={members}
          assets={equipmentAssets}
          onClose={() => setAssetModal({ mode: 'closed' })}
          onCreated={(asset) => {
            setAssetModal({ mode: 'closed' })
            toast.success('Asset added')
            void navigate({
              to: '/boats/$boatId/assets/$assetId',
              params: { boatId, assetId: asset.id },
            })
          }}
          onUpdated={(asset) => {
            setAssetModal({ mode: 'closed' })
            toast.success('Asset updated')
            void navigate({
              to: '/boats/$boatId/assets/$assetId',
              params: { boatId, assetId: asset.id },
            })
          }}
          onOpenExisting={(asset) => {
            setAssetModal({ mode: 'closed' })
            void navigate({
              to: '/boats/$boatId/assets/$assetId',
              params: { boatId, assetId: asset.id },
            })
          }}
        />
      )}
    </div>
  )
}
