import { useState } from 'react'
import { toast } from 'sonner'
import type { AssetConnectionSuggestion } from '../domain/asset-intelligence'
import { confirmAssetResearchConnections } from '../lib/boat-assets-api'
import { useTranslation } from '../lib/i18n'

export function AssetResearchConnectionsSection({
  boatId,
  assetId,
  researchJobId,
  suggestions,
  assets,
  onChange,
}: {
  boatId: string
  assetId: string
  researchJobId: string
  suggestions: AssetConnectionSuggestion[]
  assets: Array<{ id: string; name: string }>
  onChange: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  if (!suggestions.length) return null

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] p-4">
      <h3 className="m-0 text-sm font-semibold">
        {t('possibleConnections')}
      </h3>
      <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
        {t('possibleConnectionsHint')}
      </p>
      {suggestions.map((item) => (
        <label
          key={item.assetId}
          className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-bg)] p-3 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(item.assetId)}
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? [...selected, item.assetId]
                  : selected.filter((id) => id !== item.assetId),
              )
            }
          />
          <span>
            <strong>
              {assets.find((asset) => asset.id === item.assetId)?.name ??
                t('existingAsset')}
            </strong>
            <br />
            {item.reason}
          </span>
        </label>
      ))}
      <button
        type="button"
        disabled={busy || !selected.length}
        className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
        onClick={() => {
          setBusy(true)
          void confirmAssetResearchConnections(boatId, assetId, {
            researchJobId,
            connections: suggestions.filter((item) =>
              selected.includes(item.assetId),
            ),
          })
            .then(() => onChange())
            .then(() => toast.success(t('assetResearchConnectionsSaved')))
            .catch((error) =>
              toast.error(
                error instanceof Error ? error.message : t('addAssetSaveFailed'),
              ),
            )
            .finally(() => setBusy(false))
        }}
      >
        {busy ? t('saving') : t('confirmSelectedConnections')}
      </button>
    </section>
  )
}
