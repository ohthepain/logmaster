import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BoatNetworkDiagram } from '../domain/boat-network-diagram'
import type { NetworkConnectionCandidates } from '../domain/network-connection-candidates'
import {
  createNetworkEquipmentConnection,
  fetchNetworkConnectionCandidates,
} from '../lib/boat-assets-api'
import { useTranslation } from '../lib/i18n'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

export function NetworkAddConnectionMenu({
  boatId,
  diagram,
  onConnected,
}: {
  boatId: string
  diagram: BoatNetworkDiagram
  onConnected: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] =
    useState<NetworkConnectionCandidates | null>(null)
  const [filterNetworkId, setFilterNetworkId] = useState<string | null>(null)
  const [equipmentId, setEquipmentId] = useState('')

  useEffect(() => {
    if (!open) {
      setCandidates(null)
      setFilterNetworkId(null)
      setEquipmentId('')
      return
    }
    setLoading(true)
    void fetchNetworkConnectionCandidates(boatId, diagram.networkAssetId)
      .then(setCandidates)
      .catch(() => toast.error(t('addAssetSaveFailed')))
      .finally(() => setLoading(false))
  }, [boatId, diagram.networkAssetId, open, t])

  const visibleEquipment = useMemo(() => {
    if (!candidates) return []
    if (!filterNetworkId) return candidates.equipment
    return candidates.equipment.filter((item) =>
      item.networkIds.includes(filterNetworkId),
    )
  }, [candidates, filterNetworkId])

  useEffect(() => {
    if (
      equipmentId &&
      !visibleEquipment.some((item) => item.id === equipmentId)
    ) {
      setEquipmentId('')
    }
  }, [equipmentId, visibleEquipment])

  async function submit() {
    if (!equipmentId || busy) return
    setBusy(true)
    try {
      await createNetworkEquipmentConnection(
        boatId,
        diagram.networkAssetId,
        equipmentId,
      )
      setOpen(false)
      onConnected()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please retry.')
    } finally {
      setBusy(false)
    }
  }

  const hasNetworks = (candidates?.otherNetworks.length ?? 0) > 0
  const hasEquipment = visibleEquipment.length > 0

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" />
        {t('assetConnectionAdd')}
      </button>
      {open ? (
        <>
          <PopupOutsideDismiss onDismiss={() => setOpen(false)} />
          <div
            role="dialog"
            aria-labelledby={`network-add-${diagram.networkAssetId}`}
            className={`fixed inset-x-4 top-[12%] mx-auto max-h-[min(32rem,80vh)] max-w-md overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2 ${POPUP_MENU_Z_CLASS}`}
          >
            <h3
              id={`network-add-${diagram.networkAssetId}`}
              className="m-0 text-base font-semibold text-[var(--sea-ink)]"
            >
              {t('assetConnectionAdd')}
            </h3>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              {t('boatNetworkAddConnectionHelp')}
            </p>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--sea-ink-soft)]">
                {t('loadingBoat')}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {hasNetworks ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                      {t('boatNetworkOtherNetworks')}
                    </p>
                    <div className="mt-2 space-y-2">
                      <label
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                          filterNetworkId === null
                            ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]'
                            : 'border-[var(--line)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`network-filter-${diagram.networkAssetId}`}
                          className="size-5 accent-[var(--sea-ink)]"
                          checked={filterNetworkId === null}
                          onChange={() => setFilterNetworkId(null)}
                        />
                        <span className="text-sm font-semibold">
                          {t('assetConnectionEquipmentGroup')}
                        </span>
                      </label>
                      {candidates!.otherNetworks.map((network) => (
                        <label
                          key={network.id}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                            filterNetworkId === network.id
                              ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]'
                              : 'border-[var(--line)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`network-filter-${diagram.networkAssetId}`}
                            className="size-5 accent-[var(--sea-ink)]"
                            checked={filterNetworkId === network.id}
                            onChange={() => setFilterNetworkId(network.id)}
                          />
                          <span className="text-sm font-semibold">
                            {network.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
                    {t('boatNetworkCompatibleEquipment')}
                  </p>
                  {hasEquipment ? (
                    <div className="mt-2 space-y-2">
                      {visibleEquipment.map((item) => (
                        <label
                          key={item.id}
                          className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                            equipmentId === item.id
                              ? 'border-[var(--sea-ink)] bg-[var(--chip-bg)]'
                              : 'border-[var(--line)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`network-equipment-${diagram.networkAssetId}`}
                            className="size-5 accent-[var(--sea-ink)]"
                            checked={equipmentId === item.id}
                            onChange={() => setEquipmentId(item.id)}
                          />
                          <span className="min-w-0">
                            <strong className="block text-sm">
                              {item.name}
                            </strong>
                            <span className="mt-0.5 block text-xs text-[var(--sea-ink-soft)]">
                              {[item.brand, item.modelNumber]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
                      {t('boatNetworkNoConnectionCandidates')}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={busy || !equipmentId}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-50"
                onClick={() => void submit()}
              >
                {busy ? t('saving') : t('assetConnectionAdd')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
