import { Link } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AssetConnectionType } from '../domain/asset-connections'
import { ASSET_CONNECTION_TYPES } from '../domain/asset-connections'
import type { BoatAsset } from '../domain/boat-assets'
import {
  createAssetConnectionLink,
  fetchConnectionPeers,
  removeAssetConnection,
  type ConnectionPeerOption,
} from '../lib/boat-assets-api'
import { useTranslation, type TranslationKey } from '../lib/i18n'

const CONNECTION_TYPE_I18N: Record<AssetConnectionType, TranslationKey> = {
  cable: 'assetConnectionTypeCable',
  wifi: 'assetConnectionTypeWifi',
  bluetooth: 'assetConnectionTypeBluetooth',
  nmea0183: 'assetConnectionTypeNmea0183',
}

export function AssetConnectionsSection({
  asset,
  onChange,
}: {
  asset: Pick<BoatAsset, 'id' | 'boatId' | 'kind' | 'connections'>
  onChange: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [peers, setPeers] = useState<ConnectionPeerOption | null>(null)
  const [connectionType, setConnectionType] =
    useState<AssetConnectionType>('cable')
  const [peerAssetId, setPeerAssetId] = useState('')
  const [reason, setReason] = useState('')

  const canAdd = asset.kind !== 'system_network'

  useEffect(() => {
    if (!adding || peers) return
    void fetchConnectionPeers(asset.boatId)
      .then(setPeers)
      .catch(() => toast.error(t('addAssetSaveFailed')))
  }, [adding, asset.boatId, peers, t])

  const peerOptions = useMemo(() => {
    if (!peers) return { equipment: [], networks: [] }
    const equipment = peers.equipment.filter((item) => item.id !== asset.id)
    const networks =
      connectionType === 'wifi' || connectionType === 'bluetooth'
        ? []
        : peers.networks
    return { equipment, networks }
  }, [asset.id, connectionType, peers])

  useEffect(() => {
    const allowed = [
      ...peerOptions.equipment.map((item) => item.id),
      ...peerOptions.networks.map((item) => item.id),
    ]
    if (peerAssetId && !allowed.includes(peerAssetId)) setPeerAssetId('')
  }, [peerAssetId, peerOptions])

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
    <section className="mb-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
          {t('assetConnections')}
        </h2>
        {canAdd ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            disabled={!!busy}
            onClick={() => setAdding((open) => !open)}
          >
            <Plus className="size-3.5" />
            {t('assetConnectionAdd')}
          </button>
        ) : null}
      </div>

      {asset.connections.length ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {asset.connections.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                  {t(CONNECTION_TYPE_I18N[item.connectionType])}
                </span>
                {item.peer.kind === 'equipment' ? (
                  <Link
                    to="/boats/$boatId/assets/$assetId"
                    params={{
                      boatId: asset.boatId,
                      assetId: item.peer.assetId,
                    }}
                    className="mt-1 block font-semibold underline"
                  >
                    {item.peer.name}
                  </Link>
                ) : (
                  <span className="mt-1 block font-semibold">
                    {item.peer.name}
                  </span>
                )}
                {item.reason ? (
                  <span className="mt-1 block text-[var(--sea-ink-soft)]">
                    {item.reason}
                  </span>
                ) : null}
              </span>
              {canAdd ? (
                <button
                  type="button"
                  disabled={!!busy}
                  className="shrink-0 rounded-full border border-[var(--chip-line)] p-2 disabled:opacity-50"
                  aria-label={t('removeAssetConnectionConfirm', {
                    name: item.peer.name,
                  })}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t('removeAssetConnectionConfirm', {
                          name: item.peer.name,
                        }),
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
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          {t('assetConnectionsEmpty')}
        </p>
      )}

      {adding && canAdd ? (
        <form
          className="space-y-3 rounded-2xl border border-[var(--line)] p-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!peerAssetId) return
            void act('add', async () => {
              await createAssetConnectionLink(asset.boatId, asset.id, {
                connectionType,
                peerAssetId,
                reason: reason.trim() || undefined,
              })
              setAdding(false)
              setPeerAssetId('')
              setReason('')
              setConnectionType('cable')
            })
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">
              {t('assetConnectionType')}
            </span>
            <select
              className="min-h-11 w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3"
              value={connectionType}
              onChange={(event) =>
                setConnectionType(event.target.value as AssetConnectionType)
              }
            >
              {ASSET_CONNECTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(CONNECTION_TYPE_I18N[type])}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">
              {t('assetConnectionPeer')}
            </span>
            <select
              required
              className="min-h-11 w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3"
              value={peerAssetId}
              onChange={(event) => setPeerAssetId(event.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {peerOptions.networks.length ? (
                <optgroup label={t('assetConnectionNetworkGroup')}>
                  {peerOptions.networks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {peerOptions.equipment.length ? (
                <optgroup label={t('assetConnectionEquipmentGroup')}>
                  {peerOptions.equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">
              {t('assetConnectionReason')}
            </span>
            <input
              className="min-h-11 w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold"
              onClick={() => setAdding(false)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!!busy || !peerAssetId}
              className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
            >
              {busy === 'add' ? t('saving') : t('assetConnectionAdd')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
