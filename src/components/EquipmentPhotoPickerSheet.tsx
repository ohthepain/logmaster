import { Camera, CameraErrorCode } from '@capacitor/camera'
import { Camera as CameraIcon, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fileFromBase64Image, fileFromCameraMediaResult } from '../lib/camera-media-file'
import {
  listRecentPhotoThumbnails,
  loadRecentPhotoFile,
  type RecentPhotoThumbnail,
} from '../lib/native/logmaster-recent-photos'
import { useTranslation } from '../lib/i18n'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type EquipmentPhotoPickerSheetProps = {
  open: boolean
  onClose: () => void
  onPick: (file: File) => void
  onError: (message: string) => void
}

export function EquipmentPhotoPickerSheet({
  open,
  onClose,
  onPick,
  onError,
}: EquipmentPhotoPickerSheetProps) {
  const { t } = useTranslation()
  const [photos, setPhotos] = useState<RecentPhotoThumbnail[]>([])
  const [loading, setLoading] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [openingCamera, setOpeningCamera] = useState(false)

  useEffect(() => {
    if (!open) {
      setPhotos([])
      setPickingId(null)
      setOpeningCamera(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void listRecentPhotoThumbnails(60)
      .then((items) => {
        if (!cancelled) setPhotos(items)
      })
      .catch(() => {
        if (!cancelled) onError(t('addAssetCameraUnavailable'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, onError, t])

  async function handleTakePhoto() {
    setOpeningCamera(true)
    try {
      const result = await Camera.takePhoto({
        quality: 100,
        correctOrientation: true,
        includeMetadata: true,
      })
      const file = await fileFromCameraMediaResult(result)
      if (!file) {
        onError(t('addAssetCameraUnavailable'))
        return
      }
      onClose()
      onPick(file)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (
        code === CameraErrorCode.TakePhotoCancelled ||
        /cancel/i.test(String(error))
      )
        return
      onError(t('addAssetCameraUnavailable'))
    } finally {
      setOpeningCamera(false)
    }
  }

  async function handleSelectPhoto(localIdentifier: string) {
    setPickingId(localIdentifier)
    try {
      const { base64, format } = await loadRecentPhotoFile(localIdentifier)
      onClose()
      onPick(fileFromBase64Image(base64, format))
    } catch {
      onError(t('addAssetCameraUnavailable'))
    } finally {
      setPickingId(null)
    }
  }

  if (!open) return null

  const busy = openingCamera || pickingId != null

  return (
    <>
      <PopupOutsideDismiss onDismiss={onClose} />
      <div
        className={`fixed inset-x-0 bottom-0 ${POPUP_MENU_Z_CLASS} flex max-h-[66dvh] flex-col overflow-hidden rounded-t-[1.75rem] border-t border-[var(--panel-border)] bg-[var(--surface-strong)] pb-[calc(var(--lm-safe-bottom)+0.75rem)] shadow-[0_-12px_40px_rgba(0,0,0,0.18)]`}
        role="dialog"
        aria-label={t('equipmentCamera')}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <button
            type="button"
            className="min-h-11 text-sm font-medium text-[var(--sea-ink-soft)]"
            onClick={onClose}
            disabled={busy}
          >
            {t('cancel')}
          </button>
          <p className="text-sm font-semibold text-[var(--sea-ink)]">
            {t('equipmentRecentPhotos')}
          </p>
          <span className="min-w-11" aria-hidden />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-[var(--sea-ink-soft)]">
              <LoaderCircle className="size-8 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTakePhoto()}
                className="flex aspect-square flex-col items-center justify-center gap-2 bg-[var(--chip-bg)] text-[var(--sea-ink)] transition hover:bg-[var(--chip-line)] disabled:opacity-50"
              >
                {openingCamera ? (
                  <LoaderCircle className="size-8 animate-spin" aria-hidden />
                ) : (
                  <CameraIcon className="size-8 stroke-[1.5]" aria-hidden />
                )}
                <span className="px-1 text-center text-xs font-semibold">
                  {t('equipmentTakePhoto')}
                </span>
              </button>
              {photos.map((photo) => {
                const loadingThis = pickingId === photo.localIdentifier
                return (
                  <button
                    key={photo.localIdentifier}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSelectPhoto(photo.localIdentifier)}
                    className="relative aspect-square overflow-hidden bg-[var(--chip-bg)] disabled:opacity-50"
                  >
                    <img
                      src={`data:image/jpeg;base64,${photo.thumbnailBase64}`}
                      alt=""
                      className="size-full object-cover"
                    />
                    {loadingThis ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <LoaderCircle
                          className="size-7 animate-spin text-white"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
