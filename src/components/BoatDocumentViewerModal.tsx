import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BoatDocumentViewKind } from '../lib/boat-document-viewer'
import { DevComponentLabel } from './DevComponentLabel'
import { PdfDocumentPages } from './PdfDocumentPages'

type BoatDocumentViewerModalProps = {
  title: string
  contentUrl: string
  viewKind: BoatDocumentViewKind
  onClose: () => void
}

export function BoatDocumentViewerModal({
  title,
  contentUrl,
  viewKind,
  onClose,
}: BoatDocumentViewerModalProps) {
  const titleId = useId()
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [embedError, setEmbedError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (viewKind !== 'text') {
      setTextContent(null)
      setTextError(null)
      return
    }

    let cancelled = false
    void fetch(contentUrl, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load document')
        return response.text()
      })
      .then((text) => {
        if (!cancelled) setTextContent(text)
      })
      .catch((error) => {
        if (!cancelled) {
          setTextError(
            error instanceof Error ? error.message : 'Failed to load document',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [contentUrl, viewKind])

  useEffect(() => {
    if (viewKind !== 'embed') {
      setEmbedUrl(null)
      setEmbedError(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setEmbedUrl(null)
    setEmbedError(null)

    void fetch(contentUrl, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load document')
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setEmbedUrl(objectUrl)
      })
      .catch((error) => {
        if (!cancelled) {
          setEmbedError(
            error instanceof Error ? error.message : 'Failed to load document',
          )
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [contentUrl, viewKind])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      data-blocking-overlay
      className="ios-map-touch-target fixed inset-0 z-[100] flex flex-col bg-[var(--surface-strong)]"
    >
      <DevComponentLabel name="BoatDocumentViewerModal" />
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-3 sm:px-4">
        <h2
          id={titleId}
          className="m-0 min-w-0 truncate text-base font-semibold text-[var(--sea-ink)] sm:text-lg"
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)]"
        >
          Close
        </button>
      </div>

      {viewKind === 'pdf' ? (
        <PdfDocumentPages contentUrl={contentUrl} title={title} />
      ) : null}

      {viewKind === 'embed' ? (
        <div className="relative min-h-0 flex-1 bg-white">
          {embedError ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="m-0 text-sm text-red-700 dark:text-red-300">
                {embedError}
              </p>
              <a
                href={contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-[var(--sea-ink)] underline"
              >
                Open in a new tab
              </a>
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={title}
              aria-labelledby={titleId}
              className="absolute inset-0 size-full border-0 bg-white"
            />
          ) : (
            <p className="m-0 p-6 text-sm text-[var(--sea-ink-soft)]">
              Loading…
            </p>
          )}
        </div>
      ) : null}

      {viewKind === 'image' ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/95 p-3">
          <img
            src={contentUrl}
            alt={title}
            aria-labelledby={titleId}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}

      {viewKind === 'text' ? (
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--chip-bg)] p-4">
          {textError ? (
            <p className="m-0 text-sm text-red-700 dark:text-red-300">
              {textError}
            </p>
          ) : textContent === null ? (
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading…</p>
          ) : (
            <pre className="m-0 whitespace-pre-wrap break-words font-mono text-sm text-[var(--sea-ink)]">
              {textContent}
            </pre>
          )}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
