import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AddAssetModal } from './AddAssetModal'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import type { BoatAsset } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'
import { fetchBoatAssets } from '../lib/boat-assets-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'

type BoatAssetsTabProps = {
  boatId: string
  boatName: string
  orgName: string | null
  members: ResourceMember[]
}

type AssetModalState = { mode: 'closed' } | { mode: 'create' }

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
  const visibleAssets = assets.filter(
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
          onRefresh={() => load()}
          refreshing={refreshing}
        />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <ResourceSectionHeader
        title={t('assets')}
        topic="BOAT_ASSETS"
        boatId={boatId}
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
        actions={
          <button
            type="button"
            onClick={() => setAssetModal({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Plus className="h-4 w-4" />
            {t('addAsset')}
          </button>
        }
      />

      <div
        role="group"
        aria-label="Filter assets by category"
        className="mb-4 flex gap-2 overflow-x-auto pb-2"
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
              assets.filter(
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
          {assets.length
            ? 'No assets in this category.'
            : 'No assets recorded yet.'}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {visibleAssets.map((asset) => (
            <li key={asset.id}>
              <Link
                to="/boats/$boatId/assets/$assetId"
                params={{ boatId, assetId: asset.id }}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left no-underline"
              >
                <div>
                  <p className="m-0 font-semibold text-[var(--sea-ink)]">
                    {asset.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                      {asset.ownerLabel}
                    </span>
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      {asset.category ?? 'Uncategorized'}
                      {asset.modelNumber ? ` · ${asset.modelNumber}` : ''}
                    </span>
                    {asset.installedAt ? (
                      <span className="text-xs text-[var(--sea-ink-soft)]">
                        Installed{' '}
                        {new Date(asset.installedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  {asset.description ? (
                    <p className="mt-2 mb-0 text-sm text-[var(--sea-ink-soft)]">
                      {asset.description}
                    </p>
                  ) : null}
                </div>
                <ChevronRight
                  className="mt-1 size-5 shrink-0 text-[var(--sea-ink-soft)]"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {assetModal.mode === 'create' && (
        <AddAssetModal
          boatId={boatId}
          boatName={boatName}
          orgName={orgName}
          members={members}
          assets={assets}
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
