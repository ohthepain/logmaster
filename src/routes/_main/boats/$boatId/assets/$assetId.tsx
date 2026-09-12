import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AssetDocumentsSection } from '../../../../../components/AssetDocumentsSection'
import type {
  AssetWork,
  BoatAssetDetail,
  DocumentPurpose,
} from '../../../../../domain/boat-assets'
import { ASSET_WORK_TYPE_LABELS } from '../../../../../domain/boat-assets'
import {
  addAndLinkAssetDocumentLink,
  fetchBoatAsset,
  uploadAndLinkAssetDocument,
} from '../../../../../lib/boat-assets-api'

export const Route = createFileRoute('/_main/boats/$boatId/assets/$assetId')({
  component: BoatAssetDetailPage,
})

function BoatAssetDetailPage() {
  const { boatId, assetId } = Route.useParams()
  const [asset, setAsset] = useState<BoatAssetDetail | null>(null)
  const [boatName, setBoatName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBoatAsset(boatId, assetId)
      setAsset(data.asset)
      setBoatName(data.boat.name)
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
      await load()
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
      await load()
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
        </header>

        <section className="mb-8">
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
            onDocumentsChange={() => void load()}
          />
        </section>

        {asset.workRecords.length > 0 ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
              <Wrench className="size-3.5" />
              Work records
            </h2>
            <ul className="m-0 list-none space-y-2 p-0">
              {asset.workRecords.map((work) => (
                <WorkRecordItem key={work.id} work={work} />
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8">
          <Link
            to="/boats/$boatId"
            params={{ boatId }}
            search={{ tab: 'assets' }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)]"
          >
            <Pencil className="size-4" />
            Edit on boat page
          </Link>
        </div>
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
