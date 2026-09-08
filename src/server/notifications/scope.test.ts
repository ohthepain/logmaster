import { describe, expect, it } from 'vitest'
import { subscriptionScopeKey, parseScopeKey } from './scope'

describe('notification scope', () => {
  it('builds boat scope keys', () => {
    expect(subscriptionScopeKey({ boatId: 'boat-1' })).toBe('boat:boat-1')
    expect(parseScopeKey('boat:boat-1')).toEqual({
      boatId: 'boat-1',
      orgId: null,
    })
  })

  it('builds org scope keys', () => {
    expect(subscriptionScopeKey({ orgId: 'org-1' })).toBe('org:org-1')
    expect(parseScopeKey('org:org-1')).toEqual({
      boatId: null,
      orgId: 'org-1',
    })
  })

  it('uses global scope for admin topics', () => {
    expect(subscriptionScopeKey({})).toBe('global')
    expect(parseScopeKey('global')).toEqual({ boatId: null, orgId: null })
  })
})
