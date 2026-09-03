import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { cn } from '../lib/cn'
import {
  GpxFolderImportNeededError,
  GpxImportError,
  listGpxFilesFromDirectoryHandle,
  readGpxImportFilesFromFileList,
} from '../lib/gpx-import'
import { useLogbookStore } from '../stores/logbook'

export type GpxImportButtonHandle = {
  open: () => void
}

type GpxImportButtonProps = {
  onImported?: (tripId: string) => void
  className?: string
  tooltip?: string
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

export const GpxImportButton = forwardRef<GpxImportButtonHandle, GpxImportButtonProps>(
  function GpxImportButton(
    {
      onImported,
      className,
      tooltip = 'Import GPX files (Shift+click for OpenCPN export folder)',
    },
    ref,
  ) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)
    const importTripFromGpxFiles = useLogbookStore((state) => state.importTripFromGpxFiles)
    const [importing, setImporting] = useState(false)

    const importFromFiles = async (files: File[]) => {
      const gpxFiles = await readGpxImportFilesFromFileList(files)
      const trip = await importTripFromGpxFiles(gpxFiles)
      toast.success(`Imported ${trip.title ?? trip.boatName}`)
      onImported?.(trip.id)
    }

    const openFilePicker = () => {
      if (importing) return
      fileInputRef.current?.click()
    }

    const openFolderPicker = () => {
      if (importing) return
      folderInputRef.current?.click()
    }

    const pickExportFolder = async () => {
      if (importing) return

      const directoryPicker = (window as DirectoryPickerWindow).showDirectoryPicker
      if (directoryPicker) {
        try {
          setImporting(true)
          const directory = await directoryPicker.call(window)
          const files = await listGpxFilesFromDirectoryHandle(directory)
          if (files.length === 0) {
            throw new GpxImportError('No GPX files were found in that folder.')
          }
          await importFromFiles(files)
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof GpxImportError) {
            toast.error(error.message)
            return
          }
          // Fall back to the hidden directory input below.
        } finally {
          setImporting(false)
        }
      }

      openFolderPicker()
    }

    useImperativeHandle(ref, () => ({
      open: () => {
        openFilePicker()
      },
    }))

    const handlePickFile = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (importing) return
      if (event.shiftKey) {
        void pickExportFolder()
        return
      }
      openFilePicker()
    }

    const handleSelection = async (
      selectedFiles: File[],
      openFolderPickerOnFailure: boolean,
    ) => {
      if (selectedFiles.length === 0) return

      setImporting(true)
      try {
        await importFromFiles(selectedFiles)
      } catch (error) {
        if (openFolderPickerOnFailure && error instanceof GpxFolderImportNeededError) {
          toast.info(error.message)
          void pickExportFolder()
          return
        }
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files ? [...event.target.files] : []
      event.target.value = ''
      await handleSelection(selectedFiles, true)
    }

    const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files ? [...event.target.files] : []
      event.target.value = ''
      await handleSelection(selectedFiles, false)
    }

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml,application/xml"
          multiple
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFolderChange(event)}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
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
