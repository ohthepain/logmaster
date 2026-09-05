import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { cn } from '../lib/cn'
import {
  GpxFolderImportNeededError,
  GpxImportError,
  listGpxFilesFromDirectoryHandle,
  partitionGpxImportFiles,
  readGpxImportFilesFromFileList,
} from '../lib/gpx-import'
import { SignalKImportError } from '../lib/signalk-import'
import { useLogbookStore } from '../stores/logbook'
import { useRoutesStore } from '../stores/routes'

export type TripImportButtonHandle = {
  open: () => void
}

type TripImportButtonProps = {
  onImported?: (tripId: string) => void
  onRouteImported?: (routeId: string) => void
  className?: string
  tooltip?: string
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

export const TripImportButton = forwardRef<TripImportButtonHandle, TripImportButtonProps>(
  function TripImportButton(
    {
      onImported,
      onRouteImported,
      className,
      tooltip = 'Import trip or route (Shift+click for OpenCPN export folder)',
    },
    ref,
  ) {
    const gpxFileInputRef = useRef<HTMLInputElement>(null)
    const signalKFileInputRef = useRef<HTMLInputElement>(null)
    const folderInputRef = useRef<HTMLInputElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const menuId = useId()
    const importTripFromGpxFiles = useLogbookStore((state) => state.importTripFromGpxFiles)
    const importTripFromSignalK = useLogbookStore((state) => state.importTripFromSignalK)
    const importRoutesFromGpxFiles = useRoutesStore((state) => state.importRoutesFromGpxFiles)
    const [importing, setImporting] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
      if (!menuOpen) return
      const onDoc = (event: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
          setMenuOpen(false)
        }
      }
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setMenuOpen(false)
      }
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('keydown', onKey)
      return () => {
        document.removeEventListener('mousedown', onDoc)
        document.removeEventListener('keydown', onKey)
      }
    }, [menuOpen])

    const finishImport = (trip: { id: string; title?: string | null; boatName: string }) => {
      toast.success(`Imported ${trip.title ?? trip.boatName}`)
      onImported?.(trip.id)
      setMenuOpen(false)
    }

    const importFromGpxFiles = async (files: File[]) => {
      const gpxFiles = await readGpxImportFilesFromFileList(files)
      const { tripFiles, routeFiles } = partitionGpxImportFiles(gpxFiles)

      if (tripFiles.length === 0 && routeFiles.length === 0) {
        throw new GpxImportError('No GPX track or route data was found in that selection.')
      }

      if (routeFiles.length > 0) {
        const routes = await importRoutesFromGpxFiles(routeFiles)
        for (const route of routes) {
          toast.success(`Imported route ${route.title}`)
          onRouteImported?.(route.id)
        }
      }

      if (tripFiles.length > 0) {
        const trip = await importTripFromGpxFiles(tripFiles)
        finishImport(trip)
        return
      }

      setMenuOpen(false)
    }

    const importFromSignalKFile = async (file: File) => {
      const json = await file.text()
      const trip = await importTripFromSignalK(json, { fileName: file.name })
      finishImport(trip)
    }

    const openGpxFilePicker = () => {
      if (importing) return
      setMenuOpen(false)
      gpxFileInputRef.current?.click()
    }

    const openSignalKFilePicker = () => {
      if (importing) return
      setMenuOpen(false)
      signalKFileInputRef.current?.click()
    }

    const openFolderPicker = () => {
      if (importing) return
      setMenuOpen(false)
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
          await importFromGpxFiles(files)
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof GpxImportError) {
            toast.error(error.message)
            return
          }
        } finally {
          setImporting(false)
        }
      }

      openFolderPicker()
    }

    useImperativeHandle(ref, () => ({
      open: () => {
        setMenuOpen(true)
      },
    }))

    const handleMainClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (importing) return
      if (event.shiftKey) {
        void pickExportFolder()
        return
      }
      setMenuOpen((current) => !current)
    }

    const handleGpxSelection = async (
      selectedFiles: File[],
      openFolderPickerOnFailure: boolean,
    ) => {
      if (selectedFiles.length === 0) return

      setImporting(true)
      try {
        await importFromGpxFiles(selectedFiles)
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

    const handleSignalKSelection = async (selectedFiles: File[]) => {
      const file = selectedFiles[0]
      if (!file) return

      setImporting(true)
      try {
        await importFromSignalKFile(file)
      } catch (error) {
        toast.error(
          error instanceof SignalKImportError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not import Signal K file',
        )
      } finally {
        setImporting(false)
      }
    }

    const handleGpxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files ? [...event.target.files] : []
      event.target.value = ''
      await handleGpxSelection(selectedFiles, true)
    }

    const handleSignalKFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files ? [...event.target.files] : []
      event.target.value = ''
      await handleSignalKSelection(selectedFiles)
    }

    const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files ? [...event.target.files] : []
      event.target.value = ''
      await handleGpxSelection(selectedFiles, false)
    }

    return (
      <div className={cn('relative', className)} ref={rootRef}>
        <input
          ref={gpxFileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml,application/xml"
          multiple
          className="hidden"
          onChange={(event) => void handleGpxFileChange(event)}
        />
        <input
          ref={signalKFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void handleSignalKFileChange(event)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFolderChange(event)}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />

        <AppIconButtonTooltip label={tooltip} side="bottom" hidden={menuOpen}>
          <button
            type="button"
            onClick={handleMainClick}
            disabled={importing}
            aria-label={tooltip}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] transition hover:-translate-y-px hover:bg-[var(--chip-bg)] disabled:opacity-60',
            )}
          >
            <Upload className="size-5" strokeWidth={2.2} />
          </button>
        </AppIconButtonTooltip>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Import trip"
            className={cn(
              'absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
              'ring-1 ring-[var(--line)]/60',
            )}
          >
            <button
              type="button"
              role="menuitem"
              disabled={importing}
              onClick={openGpxFilePicker}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Import GPX
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={importing}
              onClick={openSignalKFilePicker}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Import Signal K
            </button>
          </div>
        ) : null}
      </div>
    )
  },
)
