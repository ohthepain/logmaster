import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import type { AssetDownloadSuggestion } from '../domain/asset-intelligence'
import type { BoatAsset } from '../domain/boat-assets'
import {
  dismissAssetSuggestion,
  downloadAssetSuggestion,
  removeAssetConnection,
} from '../lib/boat-assets-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import {
  AssetLinkTitle,
  AssetLinkTypeTag,
  copyAssetLinkUrl,
} from './AssetLinkRowParts'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

export function AssetSuggestionsSection({
  asset,
  onChange,
}: {
  asset: Pick<BoatAsset, 'id' | 'boatId' | 'suggestedDownloads' | 'connections'>
  onChange: () => Promise<unknown>
}) {
  const { t } = useTranslation()
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
          <h3 className="text-sm font-semibold">{t('assetLinks')}</h3>
          <ul className="list-none space-y-2 p-0">
            {asset.suggestedDownloads.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-3 text-sm"
              >
                <AssetLinkTypeTag url={item.url} />
                <AssetLinkTitle url={item.url} title={item.title} />
                <AssetLinkActionsMenu
                  item={item}
                  busy={busy === item.id}
                  disabled={!!busy && busy !== item.id}
                  onCopy={() =>
                    void copyAssetLinkUrl(item.url, {
                      copied: t('assetLinkCopied'),
                      failed: 'Could not copy link',
                    })
                  }
                  onDownload={() =>
                    void act(item.id, () =>
                      downloadAssetSuggestion(asset.boatId, asset.id, item.id),
                    )
                  }
                  onRemove={() => {
                    if (
                      !window.confirm(
                        t('removeAssetLinkConfirm', { title: item.title }),
                      )
                    ) {
                      return
                    }
                    void act(item.id, () =>
                      dismissAssetSuggestion(asset.boatId, asset.id, item.id),
                    )
                  }}
                />
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
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
              >
                <Link
                  to="/boats/$boatId/assets/$assetId"
                  params={{ boatId: asset.boatId, assetId: item.assetId }}
                  className="min-w-0 flex-1 font-semibold underline"
                >
                  {item.name}
                </Link>
                <button
                  type="button"
                  disabled={!!busy}
                  className="shrink-0 rounded-full border border-[var(--chip-line)] p-2 disabled:opacity-50"
                  aria-label={`Remove connection to ${item.name}`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t('removeAssetConnectionConfirm', { name: item.name }),
                      )
                    ) {
                      return
                    }
                    void act(item.id, () =>
                      removeAssetConnection(asset.boatId, asset.id, item.id),
                    )
                  }}
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

function AssetLinkActionsMenu({
  item,
  busy,
  disabled,
  onCopy,
  onDownload,
  onRemove,
}: {
  item: AssetDownloadSuggestion
  busy: boolean
  disabled: boolean
  onCopy: () => void
  onDownload: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const downloadLabel = item.documentId
    ? t('attached')
    : busy
      ? t('working')
      : t('downloadAndAttach')

  return (
    <div className="relative shrink-0 self-center">
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Link options for ${item.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface)] text-[var(--sea-ink)]',
          'transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
        )}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Link actions for ${item.title}`}
          className={cn(
            'absolute right-0 top-full mt-1 min-w-[11rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
            POPUP_MENU_Z_CLASS,
            'ring-1 ring-[var(--line)]/60',
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onCopy()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
          >
            {t('copyLink')}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy || !!item.documentId}
            onClick={() => {
              setOpen(false)
              onDownload()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
          >
            {downloadLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
          >
            {t('removeAssetLink')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
