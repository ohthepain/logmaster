import { ExternalLink, FileUp, Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent, RefObject } from 'react'
import { toast } from 'sonner'
import type {
  DocumentPurpose,
  LinkedBoatDocumentDetail,
  LinkedBoatDocumentRef,
} from '../domain/boat-assets'
import { DOCUMENT_PURPOSE_LABELS } from '../domain/boat-assets'
import { linkBoatDocument } from '../lib/boat-assets-api'
import {
  boatDocumentVersionOpenTarget,
  openBoatDocument,
  type BoatDocumentViewerPayload,
} from '../lib/boat-document-open'
import { getBoatDocumentViewKind } from '../lib/boat-document-viewer'
import { fetchBoatDocuments, fetchLinkDocumentTitle } from '../lib/boat-documents-api'
import { apiUrl } from '../lib/app-origin'
import { documentTitleFromUrl } from '../lib/document-title'
import { cn } from '../lib/cn'
import { BoatDocumentKindIcon } from './BoatDocumentActionsMenu'
import { BoatDocumentViewerModal } from './BoatDocumentViewerModal'
import { DocumentPurposeBadge } from './DocumentPurposeField'
import { Modal } from './Modal'

type AssetDocumentsSectionProps = {
  boatId: string
  assetId: string
  documents: LinkedBoatDocumentRef[] | LinkedBoatDocumentDetail[]
  showPreviews?: boolean
  uploading: boolean
  onUpload: (file: File, purpose: DocumentPurpose) => void | Promise<void>
  onAddLink: (input: {
    url: string
    title?: string
    purpose?: DocumentPurpose
  }) => void | Promise<void>
  onLinked?: () => void
}

function isDocumentDetail(
  doc: LinkedBoatDocumentRef | LinkedBoatDocumentDetail,
): doc is LinkedBoatDocumentDetail {
  return 'currentVersion' in doc
}

export function AssetDocumentsSection({
  boatId,
  assetId,
  documents,
  showPreviews = false,
  uploading,
  onUpload,
  onAddLink,
  onLinked,
}: AssetDocumentsSectionProps) {
  const [documentViewer, setDocumentViewer] =
    useState<BoatDocumentViewerPayload | null>(null)

  const detailDocuments = showPreviews
    ? (documents.filter(isDocumentDetail) as LinkedBoatDocumentDetail[])
    : []

  return (
    <div>
      {showPreviews && detailDocuments.length > 0 ? (
        <AssetDocumentPreviewGrid
          documents={detailDocuments}
          onOpenViewer={setDocumentViewer}
        />
      ) : null}

      {!showPreviews && documents.length > 0 ? (
        <ul className="mb-3 m-0 list-none p-0 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="py-1">
              {doc.title}
              {doc.purpose ? (
                <span className="ml-2 text-xs text-[var(--sea-ink-soft)]">
                  ({DOCUMENT_PURPOSE_LABELS[doc.purpose]})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <AssetDocumentDropTargets
        uploading={uploading}
        onUpload={onUpload}
        onAddLink={onAddLink}
      />

      <LinkExistingDocumentControl
        boatId={boatId}
        assetId={assetId}
        disabled={uploading}
        onLinked={onLinked}
      />

      {documentViewer ? (
        <BoatDocumentViewerModal
          title={documentViewer.title}
          contentUrl={documentViewer.contentUrl}
          viewKind={documentViewer.viewKind}
          onClose={() => setDocumentViewer(null)}
        />
      ) : null}
    </div>
  )
}

export function AssetDocumentDropTargets({
  uploading,
  onUpload,
  onAddLink,
}: {
  uploading: boolean
  onUpload: (file: File, purpose: DocumentPurpose) => void | Promise<void>
  onAddLink: (input: {
    url: string
    title?: string
    purpose?: DocumentPurpose
  }) => void | Promise<void>
}) {
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const otherInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState<DocumentPurpose | 'link' | null>(null)
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  const handleDrop = (purpose: DocumentPurpose) => (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(null)
    if (uploading) return
    const file = event.dataTransfer.files?.[0]
    if (file) void onUpload(file, purpose)
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <DocumentDropTarget
          label="Add Receipt"
          hint="Drop or choose a receipt"
          inputRef={receiptInputRef}
          dragOver={dragOver === 'receipt'}
          uploading={uploading}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!uploading) setDragOver('receipt')
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDragOver(null)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop('receipt')}
          onFileSelect={(file) => void onUpload(file, 'receipt')}
        />
        <DocumentDropTarget
          label="Add Document"
          hint="Manual, photo, warranty, etc."
          inputRef={otherInputRef}
          dragOver={dragOver === 'other'}
          uploading={uploading}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!uploading) setDragOver('other')
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDragOver(null)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop('other')}
          onFileSelect={(file) => void onUpload(file, 'other')}
        />
        <DocumentLinkDropTarget
          dragOver={dragOver === 'link'}
          uploading={uploading}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!uploading) setDragOver('link')
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDragOver(null)
          }}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => {
            if (!uploading) setLinkModalOpen(true)
          }}
        />
      </div>

      {linkModalOpen ? (
        <AddAssetLinkModal
          uploading={uploading}
          onClose={() => setLinkModalOpen(false)}
          onSubmit={async (input) => {
            await onAddLink(input)
            setLinkModalOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function DocumentDropTarget({
  label,
  hint,
  inputRef,
  dragOver,
  uploading,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
}: {
  label: string
  hint: string
  inputRef: RefObject<HTMLInputElement | null>
  dragOver: boolean
  uploading: boolean
  onDragEnter: (event: DragEvent<HTMLButtonElement>) => void
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
  onDrop: (event: DragEvent<HTMLButtonElement>) => void
  onFileSelect: (file: File) => void
}) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelect(file)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          'flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-3 py-4 text-center transition',
          dragOver
            ? 'border-[var(--sea-ink)] bg-[var(--link-bg-hover)]'
            : 'border-[var(--line)] bg-[var(--chip-bg)] hover:border-[var(--sea-ink)]/30',
          uploading && 'cursor-not-allowed opacity-60',
        )}
      >
        <FileUp className="size-5 text-[var(--sea-ink-soft)]" />
        <span className="text-sm font-semibold text-[var(--sea-ink)]">
          {uploading ? 'Uploading…' : label}
        </span>
        <span className="text-xs text-[var(--sea-ink-soft)]">{hint}</span>
      </button>
    </>
  )
}

function DocumentLinkDropTarget({
  dragOver,
  uploading,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onClick,
}: {
  dragOver: boolean
  uploading: boolean
  onDragEnter: (event: DragEvent<HTMLButtonElement>) => void
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={uploading}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      className={cn(
        'flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-3 py-4 text-center transition',
        dragOver
          ? 'border-[var(--sea-ink)] bg-[var(--link-bg-hover)]'
          : 'border-[var(--line)] bg-[var(--chip-bg)] hover:border-[var(--sea-ink)]/30',
        uploading && 'cursor-not-allowed opacity-60',
      )}
    >
      <Link2 className="size-5 text-[var(--sea-ink-soft)]" />
      <span className="text-sm font-semibold text-[var(--sea-ink)]">
        {uploading ? 'Saving…' : 'Add Link'}
      </span>
      <span className="text-xs text-[var(--sea-ink-soft)]">Manual, video, product page</span>
    </button>
  )
}

function AddAssetLinkModal({
  uploading,
  onClose,
  onSubmit,
}: {
  uploading: boolean
  onClose: () => void
  onSubmit: (input: {
    url: string
    title?: string
    purpose?: DocumentPurpose
  }) => void | Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState<DocumentPurpose>('other')
  const [titleLoading, setTitleLoading] = useState(false)
  const titleTouchedRef = useRef(false)

  useEffect(() => {
    if (titleTouchedRef.current) return
    const trimmed = url.trim()
    if (!trimmed) {
      setTitle('')
      setTitleLoading(false)
      return
    }
    const fromUrl = documentTitleFromUrl(trimmed)
    if (fromUrl) setTitle(fromUrl)
    setTitleLoading(true)
    const timer = window.setTimeout(() => {
      void fetchLinkDocumentTitle(trimmed)
        .then((pageTitle) => {
          if (titleTouchedRef.current) return
          if (pageTitle?.trim()) setTitle(pageTitle.trim())
        })
        .catch(() => {})
        .finally(() => setTitleLoading(false))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [url])

  return (
    <Modal
      title="Add link"
      showKicker={false}
      onClose={() => {
        if (!uploading) onClose()
      }}
      layer="overlay"
      devComponentName="AddAssetLinkModal"
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmedUrl = url.trim()
          if (!trimmedUrl) return
          void onSubmit({
            url: trimmedUrl,
            title: title.trim() || undefined,
            purpose,
          })
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[var(--sea-ink)]">URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            autoFocus
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--panel)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[var(--sea-ink)]">Title</span>
          <input
            value={title}
            onChange={(e) => {
              titleTouchedRef.current = true
              setTitle(e.target.value)
            }}
            placeholder={titleLoading ? 'Fetching title…' : 'Optional'}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--panel)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[var(--sea-ink)]">Purpose</span>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as DocumentPurpose)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--panel)] px-3 py-2 text-sm"
          >
            {(Object.keys(DOCUMENT_PURPOSE_LABELS) as DocumentPurpose[]).map((option) => (
              <option key={option} value={option}>
                {DOCUMENT_PURPOSE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={uploading || !url.trim()}
            className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {uploading ? 'Saving…' : 'Add link'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AssetDocumentPreviewGrid({
  documents,
  onOpenViewer,
}: {
  documents: LinkedBoatDocumentDetail[]
  onOpenViewer: (payload: BoatDocumentViewerPayload) => void
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <AssetDocumentPreviewCard
          key={doc.id}
          document={doc}
          onOpenViewer={onOpenViewer}
        />
      ))}
    </div>
  )
}

function linkHostname(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function AssetDocumentPreviewCard({
  document,
  onOpenViewer,
}: {
  document: LinkedBoatDocumentDetail
  onOpenViewer: (payload: BoatDocumentViewerPayload) => void
}) {
  const version = document.currentVersion
  const target = boatDocumentVersionOpenTarget(document.title, version)
  const viewKind = getBoatDocumentViewKind(target)
  const isLink = version.kind === 'link'
  const linkUrl = version.url

  const handleOpen = () => {
    void openBoatDocument(target, { onOpenViewer }).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to open document')
    })
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] text-left transition hover:border-[var(--sea-ink)]/25"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--chip-bg)]">
        {viewKind === 'image' && version.contentUrl ? (
          <img
            src={apiUrl(version.contentUrl)}
            alt=""
            className="size-full object-cover"
          />
        ) : viewKind === 'pdf' && version.contentUrl ? (
          <iframe
            title={document.title}
            src={apiUrl(version.contentUrl)}
            className="size-full border-0 pointer-events-none"
          />
        ) : isLink && linkUrl ? (
          <div className="flex size-full flex-col">
            <iframe
              title={document.title}
              src={linkUrl}
              sandbox="allow-scripts allow-same-origin"
              className="min-h-0 flex-1 border-0 opacity-90"
            />
            <div className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-3 py-2">
              <Link2 className="size-4 shrink-0 text-[var(--sea-ink-soft)]" />
              <span className="truncate text-xs text-[var(--sea-ink-soft)]">
                {linkHostname(linkUrl) ?? linkUrl}
              </span>
              <ExternalLink className="ml-auto size-3.5 shrink-0 text-[var(--sea-ink-soft)] opacity-0 transition group-hover:opacity-100" />
            </div>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--panel)]">
              <BoatDocumentKindIcon kind={version.kind} className="size-5" />
            </span>
            <span className="text-xs text-[var(--sea-ink-soft)]">
              {isLink ? 'Web link' : (version.fileName ?? 'Document')}
            </span>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
          {document.title}{' '}
          <DocumentPurposeBadge purpose={document.purpose} />
        </p>
        {isLink && linkUrl ? (
          <p className="m-0 mt-0.5 truncate text-xs text-[var(--sea-ink-soft)]">{linkUrl}</p>
        ) : null}
      </div>
    </button>
  )
}

function LinkExistingDocumentControl({
  boatId,
  assetId,
  disabled,
  onLinked,
}: {
  boatId: string
  assetId: string
  disabled: boolean
  onLinked?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<
    Array<{ id: string; title: string; purpose: DocumentPurpose | null }>
  >([])
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchBoatDocuments(boatId)
      .then((payload) => setDocuments(payload.documents))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load documents')
      })
  }, [boatId, open])

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--sea-ink-soft)] underline"
      >
        Link existing document…
      </button>
    )
  }

  return (
    <form
      className="mt-3 space-y-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--chip-bg)] p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!selectedId) return
        setBusy(true)
        void linkBoatDocument(boatId, selectedId, { assetId })
          .then(() => {
            toast.success('Document linked')
            setOpen(false)
            setSelectedId('')
            onLinked?.()
          })
          .catch((e) => {
            toast.error(e instanceof Error ? e.message : 'Failed to link document')
          })
          .finally(() => setBusy(false))
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--sea-ink)]">Existing document</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-xl border border-[var(--chip-line)] bg-[var(--panel)] px-3 py-2 text-sm"
        >
          <option value="">Choose…</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !selectedId}
          className="rounded-full bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)] disabled:opacity-60"
        >
          {busy ? 'Linking…' : 'Link'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
