import { Link } from '@tanstack/react-router'
import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { BoatAsset } from '../domain/boat-assets'
import {
  dismissAssetSuggestion,
  downloadAssetSuggestion,
  removeAssetConnection,
} from '../lib/boat-assets-api'

export function AssetSuggestionsSection({
  asset,
  onChange,
}: {
  asset: Pick<BoatAsset, 'id' | 'boatId' | 'suggestedDownloads' | 'connections'>
  onChange: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  async function act(id: string, run: () => Promise<unknown>) {
    if (busy) return
    setBusy(id)
    try {
      await run()
      await onChange()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="space-y-4">
      {!!asset.suggestedDownloads.length && (
        <section>
          <h3 className="text-sm font-semibold">Suggested downloads</h3>
          <ul className="list-none space-y-2 p-0">
            {asset.suggestedDownloads.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--line)] p-3 text-sm"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  {item.title}
                </a>
                <p className="mb-2 text-xs text-[var(--sea-ink-soft)]">
                  {item.reason}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={!!busy || !!item.documentId}
                    className="inline-flex items-center gap-1 font-semibold disabled:opacity-50"
                    onClick={() =>
                      void act(item.id, () =>
                        downloadAssetSuggestion(
                          asset.boatId,
                          asset.id,
                          item.id,
                        ),
                      )
                    }
                  >
                    <Download className="size-4" />
                    {item.documentId
                      ? 'Attached'
                      : busy === item.id
                        ? 'Working…'
                        : 'Download & attach'}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() =>
                      void act(item.id, () =>
                        dismissAssetSuggestion(asset.boatId, asset.id, item.id),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!asset.connections.length && (
        <section>
          <h3 className="text-sm font-semibold">Confirmed connections</h3>
          <ul className="list-none space-y-2 p-0">
            {asset.connections.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
              >
                <div>
                  <Link
                    to="/boats/$boatId/assets/$assetId"
                    params={{ boatId: asset.boatId, assetId: item.assetId }}
                    className="font-semibold underline"
                  >
                    {item.name}
                  </Link>
                  <p className="mb-0 text-xs text-[var(--sea-ink-soft)]">
                    {item.reason}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!!busy}
                  aria-label={`Remove connection to ${item.name}`}
                  onClick={() =>
                    void act(item.id, () =>
                      removeAssetConnection(asset.boatId, asset.id, item.id),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
