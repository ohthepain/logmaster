import { CircleUser } from 'lucide-react'
import { useEffect, useState } from 'react'
import { crewUserPhotoUrl } from '../lib/crew-api'
import { cn } from '../lib/cn'

type CrewAvatarProps = {
  name: string
  imageUrl?: string | null
  imagePath?: string | null
  userId?: string
  className?: string
}

export function CrewAvatar({
  name,
  imageUrl,
  imagePath,
  userId,
  className,
}: CrewAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)

  const src =
    imageUrl != null
      ? imageUrl
      : userId && imagePath
        ? crewUserPhotoUrl(userId, imagePath)
        : null

  useEffect(() => {
    setImageFailed(false)
  }, [src])

  const showPhoto = Boolean(src) && !imageFailed

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]',
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <CircleUser className="size-1/2 min-h-6 min-w-6" strokeWidth={1.5} aria-hidden />
      )}
      <span className="sr-only">{name}</span>
    </div>
  )
}
