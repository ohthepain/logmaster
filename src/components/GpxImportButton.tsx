import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { cn } from '../lib/cn'
import { GpxImportError } from '../lib/gpx-import'
import { useLogbookStore } from '../stores/logbook'

export type GpxImportButtonHandle = {
  open: () => void
}

type GpxImportButtonProps = {
  onImported?: (tripId: string) => void
  className?: string
  tooltip?: string
}

export const GpxImportButton = forwardRef<GpxImportButtonHandle, GpxImportButtonProps>(
  function GpxImportButton({ onImported, className, tooltip = 'Upload GPX file' }, ref) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const importTripFromGpx = useLogbookStore((state) => state.importTripFromGpx)
    const [importing, setImporting] = useState(false)

    useImperativeHandle(ref, () => ({
      open: () => {
        if (!importing) fileInputRef.current?.click()
      },
    }))

    const handlePickFile = () => {
      if (importing) return
      fileInputRef.current?.click()
    }

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      setImporting(true)
      try {
        const gpxXml = await file.text()
        const trip = await importTripFromGpx(gpxXml, { fileName: file.name })
        toast.success(`Imported ${trip.title ?? trip.boatName}`)
        onImported?.(trip.id)
      } catch (error) {
        toast.error(
          error instanceof GpxImportError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not import GPX file',
        )
      } finally {
        setImporting(false)
      }
    }

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml,application/xml"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <AppIconButtonTooltip label={tooltip} side="bottom">
          <button
            type="button"
            onClick={handlePickFile}
            disabled={importing}
            aria-label={tooltip}
            title={tooltip}
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)] disabled:opacity-60',
              className,
            )}
          >
            <Upload className="size-5" strokeWidth={2.2} />
          </button>
        </AppIconButtonTooltip>
      </>
    )
  },
)
