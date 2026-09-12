import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AssetEditModal,
  AssetWorkModal,
} from '../../../../../components/AssetEditorModals'
import { AssetDocumentsSection } from '../../../../../components/AssetDocumentsSection'
import { AssetSuggestionsSection } from '../../../../../components/AssetSuggestionsSection'
import type {
  AssetWork,
  BoatAssetDetail,
  DocumentPurpose,
} from '../../../../../domain/boat-assets'
import { ASSET_WORK_TYPE_LABELS } from '../../../../../domain/boat-assets'
import type { ResourceMember } from '../../../../../domain/member-invite'
import {
  addAndLinkAssetDocumentLink,
  createAssetWork,
  deleteBoatAsset,
  fetchBoatAsset,
  updateBoatAsset,
  uploadAndLinkAssetDocument,
} from '../../../../../lib/boat-assets-api'
import { fetchBoat, fetchBoatMembers } from '../../../../../lib/boats-api'

export const Route = createFileRoute('/_main/boats/$boatId/assets/$assetId')({
  component: BoatAssetDetailPage,
})

function BoatAssetDetailPage() {
  const { boatId, assetId } = Route.useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<BoatAssetDetail | null>(null)
  const [boatName, setBoatName] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [members, setMembers] = useState<ResourceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [workOpen, setWorkOpen] = useState(false)

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true)
    setError(null)
    try {
      const data = await fetchBoatAsset(boatId, assetId)
      setAsset(data.asset)
      setBoatName(data.boat.name)
      const extras = await Promise.allSettled([
        fetchBoat(boatId),
        fetchBoatMembers(boatId),
      ])
      if (extras[0].status === 'fulfilled') {
        setOrgName(extras[0].value.boat.orgName)
      }
      if (extras[1].status === 'fulfilled') {
        setMembers(extras[1].value.members)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load asset')
      setAsset(null)
    } finally {
      setLoading(false)
    }
  }, [boatId, assetId])

  useEffect(() => {
    void load()
  }, [load])

  const handleUpload = async (file: File, purpose: DocumentPurpose) => {
    setUploading(true)
    try {
      await uploadAndLinkAssetDocument(boatId, assetId, file, purpose)
      await load({ background: true })
      toast.success(
        purpose === 'receipt'
          ? 'Receipt uploaded'
          : purpose === 'photo'
            ? 'Photo uploaded'
            : 'Document uploaded',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleAddLink = async (input: {
    url: string
    title?: string
    purpose?: DocumentPurpose
  }) => {
    setUploading(true)
    try {
      await addAndLinkAssetDocumentLink(boatId, assetId, input)
      await load({ background: true })
      toast.success('Link added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add link')
      throw e
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading asset…</p>
      </main>
    )
  }

  if (error || !asset) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <div className="space-y-3">
          <Link
            to="/boats/$boatId"
            params={{ boatId }}
            search={{ tab: 'assets' }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]"
          >
            <ArrowLeft className="size-4" />
            Back to boat
          </Link>
          <p className="text-sm text-red-600">{error ?? 'Asset not found'}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-semibold text-[var(--sea-ink)]"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/boats/$boatId"
          params={{ boatId }}
          search={{ tab: 'assets' }}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
        >
          <ArrowLeft className="size-4" />
          {boatName ?? 'Boat'} · Assets
        </Link>

        <header className="mb-6">
          <h1 className="brand-title m-0 text-2xl">{asset.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
              {asset.ownerLabel}
            </span>
            <span className="text-sm text-[var(--sea-ink-soft)]">
              {asset.category ?? 'Uncategorized'}
              {asset.modelNumber ? ` · ${asset.modelNumber}` : ''}
            </span>
            {asset.installedAt ? (
              <span className="text-sm text-[var(--sea-ink-soft)]">
                Installed {new Date(asset.installedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          {asset.description ? (
            <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
              {asset.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
            >
              <Pencil className="size-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setWorkOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
            >
              <Wrench className="h-3 w-3" />
              Add work
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Remove ${asset.name}?`)) return
                void (async () => {
                  try {
                    await deleteBoatAsset(boatId, asset.id)
                    toast.success('Asset removed')
                    void navigate({
                      to: '/boats/$boatId',
                      params: { boatId },
                      search: { tab: 'assets' },
                    })
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : 'Failed to remove asset',
                    )
                  }
                })()
              }}
              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
            >
              Delete
            </button>
          </div>
        </header>

        <section className="mb-8">
          <AssetSuggestionsSection
            asset={asset}
            onChange={() => load({ background: true })}
          />
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Documents
          </h2>
          {asset.documents.length === 0 && !uploading ? (
            <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
              No documents yet. Upload a receipt or photo, add a file, or paste
              a link below.
            </p>
          ) : null}
          <AssetDocumentsSection
            boatId={boatId}
            assetId={assetId}
            documents={asset.documents}
            uploading={uploading}
            onUpload={handleUpload}
            onAddLink={handleAddLink}
            onDocumentsChange={() => void load({ background: true })}
          />
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            <Wrench className="size-3.5" />
            Work records
          </h2>
          {asset.workRecords.length === 0 ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">
              No work records yet.
            </p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {asset.workRecords.map((work) => (
                <WorkRecordItem key={work.id} work={work} />
              ))}
            </ul>
          )}
        </section>

        {editOpen ? (
          <AssetEditModal
            boatName={boatName ?? 'Boat'}
            orgName={orgName}
            members={members}
            initial={asset}
            busy={busy}
            onClose={() => setEditOpen(false)}
            onSave={async (input) => {
              setBusy(true)
              try {
                await updateBoatAsset(boatId, asset.id, input)
                toast.success('Asset updated')
                setEditOpen(false)
                await load({ background: true })
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Failed to save asset',
                )
              } finally {
                setBusy(false)
              }
            }}
          />
        ) : null}

        {workOpen ? (
          <AssetWorkModal
            assetName={asset.name}
            busy={busy}
            onClose={() => setWorkOpen(false)}
            onSave={async (input) => {
              setBusy(true)
              try {
                await createAssetWork(boatId, asset.id, input)
                toast.success('Work record added')
                setWorkOpen(false)
                await load({ background: true })
              } catch (e) {
                toast.error(
                  e instanceof Error
                    ? e.message
                    : 'Failed to add work record',
                )
              } finally {
                setBusy(false)
              }
            }}
          />
        ) : null}
      </div>
    </main>
  )
}

function WorkRecordItem({ work }: { work: AssetWork }) {
  return (
    <li className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm">
      <span className="font-semibold text-[var(--sea-ink)]">
        {ASSET_WORK_TYPE_LABELS[work.type]}
      </span>
      {work.performedAt ? (
        <span className="ml-2 text-[var(--sea-ink-soft)]">
          {new Date(work.performedAt).toLocaleDateString()}
        </span>
      ) : null}
      {work.description ? (
        <p className="m-0 mt-1 text-[var(--sea-ink-soft)]">
          {work.description}
        </p>
      ) : null}
      {work.costAmount ? (
        <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
          Cost: {work.costAmount} {work.costCurrency ?? ''}
        </p>
      ) : null}
    </li>
  )
}
