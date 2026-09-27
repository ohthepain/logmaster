import { useState } from 'react'
import type { InviteFace, InviteFaceIcon } from '../domain/invite-face'
import { cn } from '../lib/cn'

function FaceCircle({
  icon,
  className,
}: {
  icon: InviteFaceIcon
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const letter = icon.name.trim().charAt(0).toUpperCase() || '?'
  const showPhoto = Boolean(icon.imageUrl) && !failed
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--chip-bg)] font-semibold text-[var(--sea-ink)]',
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={icon.imageUrl!}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{letter}</span>
      )}
      <span className="sr-only">{icon.name}</span>
    </div>
  )
}

function BoatFan({ boats }: { boats: InviteFaceIcon[] }) {
  const mid = (boats.length - 1) / 2
  return (
    <div className="mt-3 flex h-24 items-end justify-center">
      {boats.map((boat, index) => (
        <div
          key={`${boat.name}-${index}`}
          className="-ml-3 first:ml-0"
          style={{ transform: `rotate(${(index - mid) * 8}deg)` }}
        >
          <FaceCircle icon={boat} className="size-16 text-lg" />
        </div>
      ))}
    </div>
  )
}

export function InviteSignupFace({ face }: { face: InviteFace }) {
  if (!face.valid) return null
  return (
    <div className="mb-6 text-center">
      {face.hero ? (
        <FaceCircle icon={face.hero} className="mx-auto size-20 text-2xl" />
      ) : null}
      {face.boats.length === 1 ? (
        <FaceCircle
          icon={face.boats[0]}
          className="mx-auto mt-3 size-16 text-lg"
        />
      ) : null}
      {face.boats.length > 1 ? <BoatFan boats={face.boats} /> : null}
      <p className="mt-4 text-base font-medium text-[var(--sea-ink)]">
        {face.message}
      </p>
      {face.people.length > 0 ? (
        <ul className="mt-3 flex list-none justify-center p-0">
          {face.people.map((person, index) => (
            <li key={`${person.name}-${index}`} className="-ml-2 first:ml-0">
              <FaceCircle
                icon={person}
                className="size-9 text-xs ring-2 ring-[var(--bg-base)]"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
