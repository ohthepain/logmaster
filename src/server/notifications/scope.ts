export function subscriptionScopeKey(args: {
  boatId?: string | null
  orgId?: string | null
}): string {
  if (args.boatId) return `boat:${args.boatId}`
  if (args.orgId) return `org:${args.orgId}`
  return 'global'
}

export function parseScopeKey(scopeKey: string): {
  boatId: string | null
  orgId: string | null
} {
  if (scopeKey.startsWith('boat:')) {
    return { boatId: scopeKey.slice(5), orgId: null }
  }
  if (scopeKey.startsWith('org:')) {
    return { boatId: null, orgId: scopeKey.slice(4) }
  }
  return { boatId: null, orgId: null }
}
