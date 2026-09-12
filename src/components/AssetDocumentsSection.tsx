import { FileText, FileUp, Image, Link2, MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { DragEvent, ReactNode, RefObject } from 'react'
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
  downloadBoatDocument,
  openBoatDocument,
} from '../lib/boat-document-open'
import type { BoatDocumentViewerPayload } from '../lib/boat-document-open'
import {
  deleteBoatDocument,
  fetchBoatDocuments,
  fetchLinkDocumentTitle,
  updateBoatDocumentMetadata,
} from '../lib/boat-documents-api'
import { documentTitleFromUrl } from '../lib/document-title'
import { cn } from '../lib/cn'
import { openExternalUrl } from '../lib/open-external-url'
import { BoatDocumentKindIcon } from './BoatDocumentActionsMenu'
import { BoatDocumentViewerModal } from './BoatDocumentViewerModal'
import { DocumentPurposeBadge } from './DocumentPurposeField'
import { Modal } from './Modal'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type AssetDocumentsSectionProps = {
  boatId: string
  assetId: string
  documents: LinkedBoatDocumentRef[] | LinkedBoatDocumentDetail[]
  /** Original manufacturer/source URL for attached research suggestions. */
  externalUrlByDocumentId?: ReadonlyMap<string, string>
  uploading: boolean
  onUpload: (file: File, purpose: DocumentPurpose) => void | Promise<void>
  onAddLink: (input: {
    url: string
    title?: string
    purpose?: DocumentPurpose
  }) => void | Promise<void>
  onDocumentsChange?: () => void
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
  externalUrlByDocumentId,
  uploading,
  onUpload,
  onAddLink,
  onDocumentsChange,
  onLinked,
}: AssetDocumentsSectionProps) {
  const [documentViewer, setDocumentViewer] =
    useState<BoatDocumentViewerPayload | null>(null)
  const refreshDocuments = onDocumentsChange ?? onLinked

  return (
    <div>
      {documents.length > 0 ? (
        <ul className="mb-4 m-0 list-none space-y-2 p-0">
          {documents.map((doc) => (
            <AssetDocumentListItem
              key={doc.id}
              document={doc}
              externalSourceUrl={externalUrlByDocumentId?.get(doc.id)}
              onOpenViewer={setDocumentViewer}
              onChanged={refreshDocuments}
            />
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
        onLinked={refreshDocuments}
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
  const photoInputRef = useRef<HTMLInputElement>(null)
  const otherInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState<DocumentPurpose | 'link' | null>(
    null,
  )
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  const handleDrop =
    (purpose: DocumentPurpose) => (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setDragOver(null)
      if (uploading) return
      const file = event.dataTransfer.files?.[0]
      if (file) void onUpload(file, purpose)
    }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return
            setDragOver(null)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop('receipt')}
          onFileSelect={(file) => void onUpload(file, 'receipt')}
        />
        <DocumentDropTarget
          label="Add Photo"
          hint="Drop or choose a photo"
          inputRef={photoInputRef}
          accept="image/*"
          icon={
            <Image className="size-5 text-[var(--sea-ink-soft)]" aria-hidden />
          }
          dragOver={dragOver === 'photo'}
          uploading={uploading}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!uploading) setDragOver('photo')
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return
            setDragOver(null)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop('photo')}
          onFileSelect={(file) => void onUpload(file, 'photo')}
        />
        <DocumentDropTarget
          label="Add Document"
          hint="Manual, warranty, etc."
          inputRef={otherInputRef}
          dragOver={dragOver === 'other'}
          uploading={uploading}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!uploading) setDragOver('other')
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return
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
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return
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
  accept,
  icon,
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
  accept?: string
  icon?: ReactNode
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
        accept={accept}
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
        {icon ?? (
          <FileUp className="size-5 text-[var(--sea-ink-soft)]" aria-hidden />
        )}
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
      <span className="text-xs text-[var(--sea-ink-soft)]">
        Manual, video, product page
      </span>
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
            {(Object.keys(DOCUMENT_PURPOSE_LABELS) as DocumentPurpose[]).map(
              (option) => (
                <option key={option} value={option}>
                  {DOCUMENT_PURPOSE_LABELS[option]}
                </option>
              ),
            )}
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

function AssetDocumentListItem({
  document,
  externalSourceUrl,
  onOpenViewer,
  onChanged,
}: {
  document: LinkedBoatDocumentRef | LinkedBoatDocumentDetail
  externalSourceUrl?: string
  onOpenViewer: (payload: BoatDocumentViewerPayload) => void
  onChanged?: () => void
}) {
  const version = isDocumentDetail(document) ? document.currentVersion : null
  const isLink = version?.kind === 'link'
  const linkUrl =
    externalSourceUrl ?? (version?.kind === 'link' ? version.url : null) ?? null
  const subtitle = linkUrl
    ? linkUrl
    : version
      ? isLink
        ? (version.url ?? 'Web link')
        : (version.fileName ?? 'Uploaded file')
      : document.purpose
        ? DOCUMENT_PURPOSE_LABELS[document.purpose]
        : 'Document'

  const handleOpen = () => {
    if (!version) return
    if (linkUrl) {
      void openExternalUrl(linkUrl).then((ok) => {
        if (!ok) toast.error('Could not open link')
      })
      return
    }
    const target = boatDocumentVersionOpenTarget(document.title, version)
    void openBoatDocument(target, { onOpenViewer }).catch((error) => {
      toast.error(
        error instanceof Error ? error.message : 'Failed to open document',
      )
    })
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
      <button
        type="button"
        onClick={handleOpen}
        disabled={!version}
        className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]">
          {version ? (
            <BoatDocumentKindIcon kind={version.kind} className="size-4" />
          ) : (
            <FileText className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold text-[var(--sea-ink)]">
            {document.title} <DocumentPurposeBadge purpose={document.purpose} />
          </p>
          <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">
            {subtitle}
          </p>
        </div>
      </button>
      <AssetDocumentActionsMenu document={document} onChanged={onChanged} />
    </li>
  )
}

function AssetDocumentActionsMenu({
  document,
  onChanged,
}: {
  document: LinkedBoatDocumentRef | LinkedBoatDocumentDetail
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [titleDraft, setTitleDraft] = useState(document.title)
  const menuId = useId()
  const version = isDocumentDetail(document) ? document.currentVersion : null

  const handleDownload = async () => {
    setOpen(false)
    if (!version) {
      toast.error('Document is unavailable')
      return
    }
    setBusy(true)
    try {
      await downloadBoatDocument(
        boatDocumentVersionOpenTarget(document.title, version),
      )
      if (version.kind !== 'link') toast.success('Download started')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to download document',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRename = async () => {
    const title = titleDraft.trim()
    if (!title) return
    setBusy(true)
    try {
      await updateBoatDocumentMetadata(document.id, { title })
      setRenameOpen(false)
      onChanged?.()
      toast.success('Document renamed')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to rename document',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${document.title}"?`)) return
    setBusy(true)
    try {
      await deleteBoatDocument(document.id)
      setOpen(false)
      onChanged?.()
      toast.success('Document deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative">
        {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
        <button
          type="button"
          disabled={busy}
          aria-label={`Document options for ${document.title}`}
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
            aria-label="Document actions"
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
              disabled={busy || !version}
              onClick={() => void handleDownload()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Download
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setTitleDraft(document.title)
                setOpen(false)
                setRenameOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void handleDelete()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {renameOpen ? (
        <Modal
          title="Rename"
          showKicker={false}
          onClose={() => {
            if (!busy) setRenameOpen(false)
          }}
          layer="overlay"
          devComponentName="AssetDocumentRenameModal"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Title
              </span>
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                autoFocus
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !titleDraft.trim()}
                onClick={() => void handleRename()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRenameOpen(false)}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
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
            toast.error(
              e instanceof Error ? e.message : 'Failed to link document',
            )
          })
          .finally(() => setBusy(false))
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-[var(--sea-ink)]">
          Existing document
        </span>
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
