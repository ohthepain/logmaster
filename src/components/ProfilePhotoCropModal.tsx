import { useState } from 'react'
import type { ProfilePhotoCrop } from '../lib/profile-photo-crop'
import { useTranslation } from '../lib/i18n'
import { Modal } from './Modal'
import { PhotoRegionEditor } from './PhotoRegionEditor'

type ProfilePhotoCropModalProps = {
  open: boolean
  imageUrl: string
  busy?: boolean
  onAccept: (crop: ProfilePhotoCrop) => void
  onCancel: () => void
}

export function ProfilePhotoCropModal({
  open,
  imageUrl,
  busy = false,
  onAccept,
  onCancel,
}: ProfilePhotoCropModalProps) {
  const { t } = useTranslation()
  const [seenUrl, setSeenUrl] = useState(imageUrl)
  const [crop, setCrop] = useState<ProfilePhotoCrop | null>(null)

  if (seenUrl !== imageUrl) {
    setSeenUrl(imageUrl)
    setCrop(null)
  } else if (!open && crop != null) {
    setCrop(null)
  }

  if (!open) return null

  const handleAccept = () => {
    if (!crop || busy) return
    onAccept(crop)
  }

  return (
    <Modal
      title={t('adjustProfilePhoto')}
      onClose={busy ? () => {} : onCancel}
      closeOnOutside={!busy}
      layer="overlay"
      desktopCentered
      devComponentName="ProfilePhotoCropModal"
    >
      <div className="space-y-4">
        <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {t('profilePhotoCropHelp')}
        </p>

        <PhotoRegionEditor
          imageUrl={imageUrl}
          busy={busy}
          onCropChange={setCrop}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!crop || busy}
            onClick={handleAccept}
            className="inline-flex rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {busy ? t('saving') : t('usePhoto')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
