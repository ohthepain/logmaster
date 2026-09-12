import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

type PdfDocumentPagesProps = {
  contentUrl: string
  title: string
}

type LoadedPdf = {
  pdf: PDFDocumentProxy
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
}

async function loadPdfjs() {
  const [{ getDocument, GlobalWorkerOptions }, workerSrc] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url').then(
      (module) => module.default,
    ),
  ])
  GlobalWorkerOptions.workerSrc = workerSrc
  return getDocument
}

function PdfPageCanvas({
  pageNumber,
  getPage,
  width,
}: {
  pageNumber: number
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
  width: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return

    let cancelled = false
    let renderTask: RenderTask | null = null

    void (async () => {
      const page = await getPage(pageNumber)
      if (cancelled) return

      const base = page.getViewport({ scale: 1 })
      const cssScale = width / base.width
      const outputScale = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: cssScale * outputScale })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${Math.floor(width)}px`
      canvas.style.height = `${Math.floor(base.height * cssScale)}px`

      renderTask = page.render({ canvas, viewport })
      try {
        await renderTask.promise
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'RenderingCancelledException'
        ) {
          return
        }
        throw error
      }
    })()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [getPage, pageNumber, width])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block max-w-full bg-white shadow-sm"
      aria-label={`Page ${pageNumber}`}
    />
  )
}

export function PdfDocumentPages({ contentUrl, title }: PdfDocumentPagesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef<LoadedPdf | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [width, setWidth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getPage = useCallback(async (pageNumber: number) => {
    const loaded = loadedRef.current
    if (!loaded) throw new Error('PDF is not loaded')
    return loaded.getPage(pageNumber)
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateWidth = () => {
      const next = Math.floor(node.clientWidth)
      if (next > 0) setWidth(next)
    }
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let destroy: (() => Promise<void>) | null = null

    setLoading(true)
    setError(null)
    setNumPages(0)
    loadedRef.current = null

    void (async () => {
      try {
        const getDocument = await loadPdfjs()
        const response = await fetch(contentUrl, { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to load document')
        const data = new Uint8Array(await response.arrayBuffer())
        if (data.byteLength === 0) throw new Error('Document is empty')

        const task = getDocument({
          data,
          disableRange: true,
          disableStream: true,
        })
        destroy = () => task.destroy()
        const pdf = await task.promise
        if (cancelled) return

        loadedRef.current = {
          pdf,
          getPage: (pageNumber) => pdf.getPage(pageNumber),
        }
        setNumPages(pdf.numPages)
        setLoading(false)
      } catch (caught) {
        if (cancelled) return
        setError(
          caught instanceof Error ? caught.message : 'Failed to load document',
        )
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      loadedRef.current = null
      void destroy?.()
    }
  }, [contentUrl])

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-auto bg-neutral-200 p-3"
    >
      {error ? (
        <div className="flex size-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="m-0 text-sm text-red-700 dark:text-red-300">{error}</p>
          <a
            href={contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[var(--sea-ink)] underline"
          >
            Open in a new tab
          </a>
        </div>
      ) : loading ? (
        <p className="m-0 p-6 text-sm text-[var(--sea-ink-soft)]">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: numPages }, (_, index) => (
            <PdfPageCanvas
              key={`${title}-${index + 1}`}
              pageNumber={index + 1}
              getPage={getPage}
              width={width}
            />
          ))}
        </div>
      )}
    </div>
  )
}
