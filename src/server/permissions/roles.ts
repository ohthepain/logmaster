export type Privilege = 'view' | 'edit' | 'manage' | 'admin'

export type ConsortiumMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

const ROLE_PRIVILEGES: Record<ConsortiumMemberRole, ReadonlySet<Privilege>> = {
  OWNER: new Set(['view', 'edit', 'manage', 'admin']),
  ADMIN: new Set(['view', 'edit', 'manage', 'admin']),
  MEMBER: new Set(['view', 'edit']),
  VIEWER: new Set(['view']),
}

export function roleHasPrivilege(
  role: ConsortiumMemberRole,
  privilege: Privilege,
): boolean {
  return ROLE_PRIVILEGES[role].has(privilege)
}

export function adminRoles(): ConsortiumMemberRole[] {
  return ['OWNER', 'ADMIN']
}

const ROLE_STRENGTH: Record<ConsortiumMemberRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
}

export function strongestRole(
  roles: Array<ConsortiumMemberRole | null | undefined>,
): ConsortiumMemberRole | null {
  let best: ConsortiumMemberRole | null = null
  let bestStrength = 0
  for (const role of roles) {
    if (!role) continue
    const strength = ROLE_STRENGTH[role]
    if (strength > bestStrength) {
      best = role
      bestStrength = strength
    }
  }
  return best
}
