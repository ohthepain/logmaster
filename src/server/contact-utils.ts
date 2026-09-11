import type { ContactResourceArea } from '../domain/contact'
import { canAccess } from './permissions/access'
import { canAccessBoatArea, canAccessOrgArea } from './permissions/contacts'
import type { Privilege } from './permissions/roles'

export async function canAccessBoatResource(
  userId: string | null,
  boatId: string,
  area: ContactResourceArea,
  privilege: Privilege,
  opts?: { shareToken?: string },
): Promise<boolean> {
  if (await canAccess(userId, privilege, { type: 'boat', id: boatId }, opts)) {
    return true
  }
  return canAccessBoatArea(userId, boatId, area, privilege)
}

export async function canAccessOrgResource(
  userId: string | null,
  orgId: string,
  area: ContactResourceArea,
  privilege: Privilege,
  opts?: { shareToken?: string },
): Promise<boolean> {
  if (
    await canAccess(userId, privilege, { type: 'consortium', id: orgId }, opts)
  ) {
    return true
  }
  return canAccessOrgArea(userId, orgId, area, privilege)
}
