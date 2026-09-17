import { FileUp, Link2 } from 'lucide-react'
import { apiUrl } from '../lib/app-origin'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { toast } from 'sonner'
import type { BoatDocument, BoatDocumentCategory } from '../domain/boat'
import {
  createBoatDocumentLink,
  createBoatDocumentUpload,
  fetchBoatDocuments,
  fetchLinkDocumentTitle,
} from '../lib/boat-documents-api'
import {
  documentTitleFromFileName,
  documentTitleFromUrl,
  resolveDocumentLinkTitle,
} from '../lib/document-title'
import { openBoatDocumentRecord } from '../lib/boat-document-open'
import type { BoatDocumentViewerPayload } from '../lib/boat-document-open'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'
import { Modal } from './Modal'
import { BoatDocumentCategoryField } from './BoatDocumentCategoryField'
import { BoatDocumentViewerModal } from './BoatDocumentViewerModal'
import {
  BoatDocumentActionsMenu,
  BoatDocumentKindIcon,
} from './BoatDocumentActionsMenu'
import {
  DocumentPurposeBadge,
  DocumentPurposeField,
} from './DocumentPurposeField'
import type { DocumentPurpose } from '../domain/boat-assets'

type BoatDocumentsTabProps = {
  boatId: string
}

type AddMode = 'upload' | 'link' | null

const BOAT_RESOURCE_CARD_GRID =
  'grid grid-cols-1 gap-3 landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

function documentPreviewUrl(document: BoatDocument): string | null {
  const version = document.currentVersion
  if (!version.contentUrl) return null
  const mime = version.mimeType?.toLowerCase() ?? ''
  if (!mime.startsWith('image/')) return null
  return apiUrl(version.contentUrl)
}

export function BoatDocumentsTab({ boatId }: BoatDocumentsTabProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<BoatDocumentCategory[]>([])
  const [documents, setDocuments] = useState<BoatDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [busy, setBusy] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [purposeDraft, setPurposeDraft] = useState<DocumentPurpose | ''>('')
  const [linkDraft, setLinkDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [linkTitleLoading, setLinkTitleLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleTouchedRef = useRef(false)
  const linkTitleRequestRef = useRef(0)
  const [documentViewer, setDocumentViewer] =
    useState<BoatDocumentViewerPayload | null>(null)

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (opts?.background) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await fetchBoatDocuments(boatId)
        setCategories(data.categories)
        setDocuments(data.documents)
        setCategoryDraft((current) => {
          if (current && data.categories.some((c) => c.id === current)) {
            return current
          }
          return data.categories[0]?.id ?? ''
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load documents')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [boatId],
  )

  useEffect(() => {
    void load()
  }, [load])

  const categoryName = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name ??
    'Uncategorized'

  const documentsByCategory = categories
    .map((category) => ({
      category,
      documents: documents.filter(
        (document) => document.categoryId === category.id,
      ),
    }))
    .filter((group) => group.documents.length > 0)

  const openAdd = (mode: AddMode) => {
    setTitleDraft('')
    setLinkDraft('')
    setDragOver(false)
    setLinkTitleLoading(false)
    titleTouchedRef.current = false
    linkTitleRequestRef.current += 1
    setAddMode(mode)
  }

  const addCategory = (category: BoatDocumentCategory) => {
    setCategories((current) =>
      [...current, category].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    )
  }

  const handleOpenDocument = async (document: BoatDocument) => {
    try {
      await openBoatDocumentRecord(document, {
        onOpenViewer: setDocumentViewer,
      })
    } catch (openError) {
      toast.error(
        openError instanceof Error
          ? openError.message
          : 'Failed to open document',
      )
    }
  }

  const handleCreateUpload = async (file: File) => {
    if (!categoryDraft) {
      toast.error('Choose a category')
      return
    }
    setBusy(true)
    try {
      const document = await createBoatDocumentUpload(boatId, {
        title: documentTitleFromFileName(file.name),
        categoryId: categoryDraft,
        file,
        purpose: purposeDraft || null,
      })
      setDocuments((current) => [...current, document])
      setAddMode(null)
      toast.success('Document uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      setDragOver(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (addMode !== 'link' || titleTouchedRef.current) return

    const url = linkDraft.trim()
    if (!url) {
      setTitleDraft('')
      setLinkTitleLoading(false)
      return
    }

    const fromUrl = documentTitleFromUrl(url)
    if (fromUrl) setTitleDraft(fromUrl)

    const requestId = linkTitleRequestRef.current + 1
    linkTitleRequestRef.current = requestId
    setLinkTitleLoading(true)

    const timer = window.setTimeout(() => {
      void fetchLinkDocumentTitle(url)
        .then((pageTitle) => {
          if (titleTouchedRef.current) return
          if (linkTitleRequestRef.current !== requestId) return
          if (pageTitle?.trim()) setTitleDraft(pageTitle.trim())
        })
        .catch(() => {})
        .finally(() => {
          if (linkTitleRequestRef.current === requestId) {
            setLinkTitleLoading(false)
          }
        })
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [addMode, linkDraft])

  const handleCreateLink = async () => {
    const url = linkDraft.trim()
    if (!url || !categoryDraft) return
    const title = resolveDocumentLinkTitle(url, { title: titleDraft })
    setBusy(true)
    try {
      const document = await createBoatDocumentLink(boatId, {
        title,
        categoryId: categoryDraft,
        url,
        purpose: purposeDraft || null,
      })
      setDocuments((current) => [...current, document])
      setAddMode(null)
      toast.success('Link added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add link')
    } finally {
      setBusy(false)
    }
  }

  const handleUploadDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(false)
    if (busy) return
    const file = event.dataTransfer.files?.[0]
    if (file) void handleCreateUpload(file)
  }

  if (loading) {
    return (
      <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
        Loading documents…
      </p>
    )
  }

  if (error) {
    return (
      <div className="mt-6 space-y-3">
        <ResourceSectionHeader
          title={t('documents')}
          topic="BOAT_DOCUMENTS"
          boatId={boatId}
          onRefresh={() => load()}
          refreshing={refreshing}
        />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      <ResourceSectionHeader
        title={t('documents')}
        topic="BOAT_DOCUMENTS"
        boatId={boatId}
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openAdd('upload')}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
        >
          <FileUp className="size-4" />
          {t('uploadDocument')}
        </button>
        <button
          type="button"
          onClick={() => openAdd('link')}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
        >
          <Link2 className="size-4" />
          {t('addLink')}
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
          {t('noDocumentsYet')}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {documentsByCategory.map(({ category, documents: groupDocs }) => (
            <section key={category.id}>
              <h2 className="m-0 mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sea-ink-soft)]">
                {category.name}
              </h2>
              <ul className={cn('m-0 list-none p-0', BOAT_RESOURCE_CARD_GRID)}>
                {groupDocs.map((document) => {
                  const previewUrl = documentPreviewUrl(document)
                  return (
                    <li
                      key={document.id}
                      className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]"
                    >
                      <button
                        type="button"
                        onClick={() => void handleOpenDocument(document)}
                        className="flex min-w-0 flex-1 flex-col text-left transition hover:bg-[var(--chip-bg)]"
                      >
                        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--chip-bg)]">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <BoatDocumentKindIcon
                              kind={document.currentVersion.kind}
                              className="size-10 text-[var(--sea-ink)]"
                            />
                          )}
                        </div>
                        <div className="min-w-0 p-3 pr-12">
                          <p className="m-0 line-clamp-2 text-sm font-semibold leading-snug text-[var(--sea-ink)]">
                            {document.title}{' '}
                            <DocumentPurposeBadge purpose={document.purpose} />
                          </p>
                          <p className="m-0 mt-1 line-clamp-2 text-xs text-[var(--sea-ink-soft)]">
                            {document.currentVersion.kind === 'link'
                              ? document.currentVersion.url
                              : (document.currentVersion.fileName ??
                                'Uploaded file')}
                          </p>
                          <p className="m-0 mt-1 text-[10px] text-[var(--sea-ink-soft)]">
                            Updated{' '}
                            {new Date(document.updatedAt).toLocaleDateString()}
                            {' · '}v{document.currentVersion.versionNumber}
                          </p>
                        </div>
                      </button>
                      <div className="absolute right-2 top-2">
                        <BoatDocumentActionsMenu
                          boatId={boatId}
                          boatDocument={document}
                          categoryName={categoryName(document.categoryId)}
                          categories={categories}
                          onCategoryCreated={addCategory}
                          onOpenViewer={setDocumentViewer}
                          onUpdated={(updated) =>
                            setDocuments((current) =>
                              current.map((item) =>
                                item.id === updated.id ? updated : item,
                              ),
                            )
                          }
                          onDeleted={(documentId) =>
                            setDocuments((current) =>
                              current.filter((item) => item.id !== documentId),
                            )
                          }
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {addMode === 'upload' ? (
        <Modal
          title={t('uploadDocument')}
          showKicker={false}
          onClose={() => {
            if (!busy) setAddMode(null)
          }}
          layer="overlay"
          devComponentName="BoatDocumentAddModal"
        >
          <div
            className="space-y-4"
            onDragEnter={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!busy) setDragOver(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!busy) setDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return
              }
              setDragOver(false)
            }}
            onDrop={handleUploadDrop}
          >
            <BoatDocumentCategoryField
              categories={categories}
              value={categoryDraft}
              onChange={setCategoryDraft}
              onCategoryCreated={addCategory}
              boatId={boatId}
              busy={busy}
              setBusy={setBusy}
            />
            <DocumentPurposeField
              value={purposeDraft}
              onChange={setPurposeDraft}
            />

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleCreateUpload(file)
              }}
            />

            <button
              type="button"
              disabled={busy || !categoryDraft}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition',
                dragOver
                  ? 'border-[var(--sea-ink)] bg-[var(--link-bg-hover)]'
                  : 'border-[var(--line)] bg-[var(--chip-bg)] hover:border-[var(--sea-ink)]/30',
                (busy || !categoryDraft) && 'cursor-not-allowed opacity-60',
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
                Title comes from the file name
              </span>
            </button>
          </div>
        </Modal>
      ) : null}

      {addMode === 'link' ? (
        <Modal
          title="Add document link"
          showKicker={false}
          onClose={() => {
            if (!busy) setAddMode(null)
          }}
          layer="overlay"
          devComponentName="BoatDocumentLinkModal"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                URL
              </span>
              <input
                type="url"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://"
                autoFocus
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>

            <BoatDocumentCategoryField
              categories={categories}
              value={categoryDraft}
              onChange={setCategoryDraft}
              onCategoryCreated={addCategory}
              boatId={boatId}
              busy={busy}
              setBusy={setBusy}
            />
            <DocumentPurposeField
              value={purposeDraft}
              onChange={setPurposeDraft}
            />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Title
              </span>
              <input
                value={titleDraft}
                onChange={(e) => {
                  titleTouchedRef.current = true
                  setTitleDraft(e.target.value)
                }}
                placeholder={linkTitleLoading ? 'Fetching title…' : 'Optional'}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
              <p className="mt-1.5 text-xs text-[var(--sea-ink-soft)]">
                {linkTitleLoading
                  ? 'Looking up title from the page…'
                  : 'Filled automatically from the URL unless you edit it'}
              </p>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !linkDraft.trim() || !categoryDraft}
                onClick={() => void handleCreateLink()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
              >
                {busy ? t('saving') : t('addLink')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddMode(null)}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

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
