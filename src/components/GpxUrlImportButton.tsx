import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { Modal } from './Modal'
import { cn } from '../lib/cn'
import { GpxImportError } from '../lib/gpx-import'
import { fetchGpxFromUrl, gpxFileNameFromUrl } from '../lib/gpx-url-import'
import { useLogbookStore } from '../stores/logbook'

type GpxUrlImportButtonProps = {
  onImported?: (tripId: string) => void
  className?: string
  tooltip?: string
}

export function GpxUrlImportButton({
  onImported,
  className,
  tooltip = 'Import GPX from URL',
}: GpxUrlImportButtonProps) {
  const importTripFromGpx = useLogbookStore((state) => state.importTripFromGpx)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    try {
      const gpxXml = await fetchGpxFromUrl(url)
      const trip = await importTripFromGpx(gpxXml, {
        fileName: gpxFileNameFromUrl(url),
      })
      toast.success(`Imported ${trip.title ?? trip.boatName}`)
      setOpen(false)
      setUrl('')
      onImported?.(trip.id)
    } catch (error) {
      toast.error(
        error instanceof GpxImportError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not import GPX from URL',
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <AppIconButtonTooltip label={tooltip} side="bottom">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={importing}
          aria-label={tooltip}
          title={tooltip}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)] disabled:opacity-60',
            className,
          )}
        >
          <Link2 className="size-5" strokeWidth={2.2} />
        </button>
      </AppIconButtonTooltip>

      {open ? (
        <Modal
          title="Import GPX from URL"
          onClose={() => {
            if (!importing) setOpen(false)
          }}
          layer="overlay"
          devComponentName="GpxUrlImportModal"
        >
          <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
            Paste a link to a GPX file. GitHub blob links are converted automatically; other hosts need a direct download URL.
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
              GPX URL
            </span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              autoFocus
              value={url}
              disabled={importing}
              placeholder="https://example.com/track.gpx"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleImport()
              }}
              className="w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2.5 text-sm text-[var(--sea-ink)] outline-none ring-[var(--brand)] focus:ring-2 disabled:opacity-60"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={importing || !url.trim()}
              onClick={() => void handleImport()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {importing ? 'Importing…' : 'Import trip'}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
