export type BoatShareOwnerSummary = {
  userId: string
  name: string
  email: string
  image: string | null
}

export type BoatShareSummary = {
  id: string
  boatId: string
  sequence: number
  label: string | null
  displayName: string
  owners: BoatShareOwnerSummary[]
}

type ShareOwnerRow = {
  userId: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

type ShareRow = {
  id: string
  boatId: string
  sequence: number
  label: string | null
  owners: ShareOwnerRow[]
}

export function defaultShareLabel(sequence: number): string {
  return `Share ${sequence + 1}`
}

export function compareShareOwners(a: ShareOwnerRow, b: ShareOwnerRow): number {
  const name = a.user.name.localeCompare(b.user.name, undefined, {
    sensitivity: 'base',
  })
  if (name !== 0) return name
  return a.user.email.localeCompare(b.user.email, undefined, {
    sensitivity: 'base',
  })
}

export function serializeBoatShare(share: ShareRow): BoatShareSummary {
  const owners = share.owners
    .slice()
    .sort(compareShareOwners)
    .map((owner) => ({
      userId: owner.user.id,
      name: owner.user.name,
      email: owner.user.email,
      image: owner.user.image,
    }))

  return {
    id: share.id,
    boatId: share.boatId,
    sequence: share.sequence,
    label: share.label,
    displayName: share.label?.trim() || defaultShareLabel(share.sequence),
    owners,
  }
}

export function serializeBoatShares(shares: ShareRow[]): BoatShareSummary[] {
  return shares
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map(serializeBoatShare)
}

/** Each co-owner of a share holds an equal fraction of that share. */
export function shareOwnerFraction(share: BoatShareSummary): number {
  if (share.owners.length === 0) return 0
  return 1 / share.owners.length
}

/** Total fractional ownership for a user across all shares on a boat. */
export function userBoatOwnershipFraction(
  shares: BoatShareSummary[],
  userId: string,
): number {
  return shares.reduce((total, share) => {
    const isOwner = share.owners.some((owner) => owner.userId === userId)
    return isOwner ? total + shareOwnerFraction(share) : total
  }, 0)
}
