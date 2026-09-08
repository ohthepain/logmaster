import { Building2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Org, OrgPhoto } from '../domain/org'
import { defaultOrgPhoto } from '../domain/org'
import { updateOrgPhoto, uploadOrgPhoto } from '../lib/orgs-api'
import { cn } from '../lib/cn'

type OrgIconSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<OrgIconSize, string> = {
  sm: 'size-9',
  md: 'size-10 sm:size-12',
  lg: 'size-14',
}

const FALLBACK_ICON_CLASS: Record<OrgIconSize, string> = {
  sm: 'size-4',
  md: 'size-5 sm:size-6',
  lg: 'size-7',
}

export function orgIconPhoto(org: Pick<Org, 'photos' | 'defaultPhoto'>): OrgPhoto | null {
  return org.defaultPhoto ?? defaultOrgPhoto(org.photos)
}

type OrgIconProps = {
  photo: OrgPhoto | null
  size?: OrgIconSize
  className?: string
}

export function OrgIcon({ photo, size = 'md', className }: OrgIconProps) {
  const sizeClass = SIZE_CLASS[size]

  if (photo) {
    return (
      <img
        src={photo.imageUrl}
        alt=""
        draggable={false}
        className={cn(sizeClass, 'shrink-0 rounded-xl object-cover', className)}
      />
    )
  }

  return (
    <span
      className={cn(
        sizeClass,
        'inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]',
        className,
      )}
    >
      <Building2 className={cn(FALLBACK_ICON_CLASS[size], 'text-[var(--sea-ink-soft)]')} />
    </span>
  )
}

type OrgIconSelectorProps = {
  org: Org
  onOrgChange: (org: Org) => void
  disabled?: boolean
  size?: OrgIconSize
  className?: string
}

export function OrgIconSelector({
  org,
  onOrgChange,
  disabled = false,
  size = 'md',
  className,
}: OrgIconSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const photo = orgIconPhoto(org)

  const applyPhotos = (photos: OrgPhoto[]) => {
    onOrgChange({
      ...org,
      photos,
      defaultPhoto: defaultOrgPhoto(photos),
    })
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadOrgPhoto(org.id, file)
      let photos = [...org.photos.filter((item) => item.id !== uploaded.id), uploaded]

      if (!uploaded.isDefault) {
        const updated = await updateOrgPhoto(uploaded.id, { isDefault: true })
        photos = photos.map((item) =>
          item.id === updated.id ? updated : { ...item, isDefault: false },
        )
      }

      applyPhotos(photos.sort((a, b) => a.sortOrder - b.sortOrder))
      toast.success('Organization image updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleUpload(file)
        }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        aria-label={photo ? 'Change organization image' : 'Add organization image'}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'shrink-0 p-0 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <OrgIcon photo={photo} size={size} />
      </button>
    </>
  )
}
