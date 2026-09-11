import {
  ExternalLink,
  FileText,
  FileUp,
  Link2,
  MoreHorizontal,
} from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { toast } from 'sonner'
import type {
  BoatDocument,
  BoatDocumentCategory,
  BoatDocumentVersion,
} from '../domain/boat'
import {
  deleteBoatDocument,
  fetchBoatDocumentVersions,
  updateBoatDocumentLink,
  updateBoatDocumentMetadata,
  updateBoatDocumentUpload,
} from '../lib/boat-documents-api'
import { documentTitleFromFileName } from '../lib/document-title'
import {
  boatDocumentOpenTarget,
  boatDocumentVersionOpenTarget,
  openBoatDocument,
} from '../lib/boat-document-open'
import type { BoatDocumentViewerPayload } from '../lib/boat-document-open'
import { cn } from '../lib/cn'
import { BoatDocumentCategoryField } from './BoatDocumentCategoryField'
import { Modal } from './Modal'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type BoatDocumentActionsMenuProps = {
  boatId: string
  boatDocument: BoatDocument
  categoryName: string
  categories: Array<{ id: string; name: string }>
  onCategoryCreated: (category: BoatDocumentCategory) => void
  onOpenViewer: (payload: BoatDocumentViewerPayload) => void
  onUpdated: (document: BoatDocument) => void
  onDeleted: (documentId: string) => void
}

export function BoatDocumentActionsMenu({
  boatId,
  boatDocument,
  categoryName,
  categories,
  onCategoryCreated,
  onOpenViewer,
  onUpdated,
  onDeleted,
}: BoatDocumentActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [editTitleOpen, setEditTitleOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<BoatDocumentVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [titleDraft, setTitleDraft] = useState(boatDocument.title)
  const [categoryDraft, setCategoryDraft] = useState(boatDocument.categoryId)
  const [linkDraft, setLinkDraft] = useState(
    boatDocument.currentVersion.url ?? '',
  )
  const [dragOver, setDragOver] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuId = useId()
  const isLink = boatDocument.currentVersion.kind === 'link'

  const openUpdate = () => {
    setCategoryDraft(boatDocument.categoryId)
    setLinkDraft(boatDocument.currentVersion.url ?? '')
    setDragOver(false)
    setOpen(false)
    setUpdateOpen(true)
  }

  const openEditTitle = () => {
    setTitleDraft(boatDocument.title)
    setOpen(false)
    setEditTitleOpen(true)
  }

  const openHistory = async () => {
    setOpen(false)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      setVersions(await fetchBoatDocumentVersions(boatDocument.id))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load history',
      )
      setHistoryOpen(false)
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${boatDocument.title}"?`)) return
    setBusy(true)
    try {
      await deleteBoatDocument(boatDocument.id)
      onDeleted(boatDocument.id)
      toast.success('Document deleted')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const applyMetadataUpdates = async (
    base: BoatDocument,
  ): Promise<BoatDocument> => {
    if (categoryDraft === base.categoryId) return base
    return updateBoatDocumentMetadata(base.id, { categoryId: categoryDraft })
  }

  const handleSaveTitle = async () => {
    const title = titleDraft.trim()
    if (!title) return
    setBusy(true)
    try {
      const updated = await updateBoatDocumentMetadata(boatDocument.id, {
        title,
      })
      onUpdated(updated)
      setEditTitleOpen(false)
      toast.success('Title updated')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update title',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSaveUpdate = async () => {
    setBusy(true)
    try {
      let updated = boatDocument
      updated = await applyMetadataUpdates(updated)
      if (
        isLink &&
        linkDraft.trim() !== (boatDocument.currentVersion.url ?? '')
      ) {
        updated = await updateBoatDocumentLink(
          boatDocument.id,
          linkDraft.trim(),
        )
      }
      onUpdated(updated)
      setUpdateOpen(false)
      toast.success('Document updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const handleReplaceFile = async (file: File) => {
    setBusy(true)
    try {
      let updated = await updateBoatDocumentUpload(boatDocument.id, file)
      const newTitle = documentTitleFromFileName(file.name)
      if (newTitle !== updated.title) {
        updated = await updateBoatDocumentMetadata(updated.id, {
          title: newTitle,
        })
      }
      if (categoryDraft !== updated.categoryId) {
        updated = await updateBoatDocumentMetadata(updated.id, {
          categoryId: categoryDraft,
        })
      }
      onUpdated(updated)
      setUpdateOpen(false)
      toast.success('New version uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusy(false)
      setDragOver(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReplaceDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    if (busy) return
    const file = event.dataTransfer.files?.[0]
    if (file) void handleReplaceFile(file)
  }

  const openCurrent = async () => {
    setOpen(false)
    try {
      await openBoatDocument(boatDocumentOpenTarget(boatDocument), {
        onOpenViewer,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to open document',
      )
    }
  }

  const openVersion = async (version: BoatDocumentVersion) => {
    try {
      await openBoatDocument(
        boatDocumentVersionOpenTarget(boatDocument.title, version),
        { onOpenViewer },
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to open document',
      )
    }
  }

  return (
    <>
      <div className="relative" ref={rootRef}>
        {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
        <button
          type="button"
          disabled={busy}
          aria-label={`Document options for ${boatDocument.title}`}
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
              disabled={busy}
              onClick={() => void openCurrent()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Open
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={openEditTitle}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Edit title
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={openUpdate}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Update
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void openHistory()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              View history
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

      {updateOpen ? (
        <Modal
          title="Update document"
          showKicker={false}
          onClose={() => {
            if (!busy) setUpdateOpen(false)
          }}
          layer="overlay"
          devComponentName="BoatDocumentUpdateModal"
        >
          <div
            className="space-y-4"
            onDragEnter={
              isLink
                ? undefined
                : (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!busy) setDragOver(true)
                  }
            }
            onDragOver={
              isLink
                ? undefined
                : (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!busy) setDragOver(true)
                  }
            }
            onDragLeave={
              isLink
                ? undefined
                : (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (
                      event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      return
                    }
                    setDragOver(false)
                  }
            }
            onDrop={isLink ? undefined : handleReplaceDrop}
          >
            <BoatDocumentCategoryField
              categories={categories}
              value={categoryDraft}
              onChange={setCategoryDraft}
              onCategoryCreated={onCategoryCreated}
              boatId={boatId}
              busy={busy}
              setBusy={setBusy}
            />

            {isLink ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                  Link URL
                </span>
                <input
                  type="url"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
                />
                <p className="mt-1.5 text-xs text-[var(--sea-ink-soft)]">
                  Changing the URL saves a new version in history.
                </p>
              </label>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleReplaceFile(file)
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition',
                    dragOver
                      ? 'border-[var(--sea-ink)] bg-[var(--link-bg-hover)]'
                      : 'border-[var(--line)] bg-[var(--chip-bg)] hover:border-[var(--sea-ink)]/30',
                    busy && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <FileUp className="size-8 text-[var(--sea-ink-soft)]" />
                  <span className="text-sm font-semibold text-[var(--sea-ink)]">
                    {busy
                      ? 'Uploading…'
                      : dragOver
                        ? 'Drop to upload'
                        : 'Choose a file or drag it here'}
                  </span>
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    Current:{' '}
                    {boatDocument.currentVersion.fileName ?? categoryName}
                    {' · '}
                    Title comes from the file name
                  </span>
                </button>
              </>
            )}

            {isLink ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    busy ||
                    (categoryDraft === boatDocument.categoryId &&
                      linkDraft.trim() ===
                        (boatDocument.currentVersion.url ?? ''))
                  }
                  onClick={() => void handleSaveUpdate()}
                  className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUpdateOpen(false)}
                  className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || categoryDraft === boatDocument.categoryId}
                  onClick={() => void handleSaveUpdate()}
                  className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save category'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUpdateOpen(false)}
                  className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {editTitleOpen ? (
        <Modal
          title="Edit title"
          showKicker={false}
          onClose={() => {
            if (!busy) setEditTitleOpen(false)
          }}
          layer="overlay"
          devComponentName="BoatDocumentEditTitleModal"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Title
              </span>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                autoFocus
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !titleDraft.trim()}
                onClick={() => void handleSaveTitle()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditTitleOpen(false)}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {historyOpen ? (
        <Modal
          title="Document history"
          showKicker={false}
          onClose={() => {
            if (!historyLoading) setHistoryOpen(false)
          }}
          layer="overlay"
          devComponentName="BoatDocumentHistoryModal"
        >
          <div className="space-y-3">
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
              {boatDocument.title}
            </p>
            {historyLoading ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">No versions.</p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                        Version {version.versionNumber}
                        {version.id === boatDocument.currentVersion.id ? (
                          <span className="ml-2 text-xs font-medium text-[var(--sea-ink-soft)]">
                            (current)
                          </span>
                        ) : null}
                      </p>
                      <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">
                        {version.kind === 'link'
                          ? version.url
                          : (version.fileName ?? 'Uploaded file')}
                      </p>
                      <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {version.kind === 'link' && version.url ? (
                      <a
                        href={version.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] no-underline"
                      >
                        <ExternalLink className="size-3.5" />
                        Open
                      </a>
                    ) : version.contentUrl ? (
                      <button
                        type="button"
                        onClick={() => void openVersion(version)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)]"
                      >
                        <FileText className="size-3.5" />
                        View
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      ) : null}
    </>
  )
}

export function BoatDocumentKindIcon({
  kind,
  className,
}: {
  kind: BoatDocument['currentVersion']['kind']
  className?: string
}) {
  if (kind === 'link') {
    return <Link2 className={className} aria-hidden />
  }
  return <FileText className={className} aria-hidden />
}
