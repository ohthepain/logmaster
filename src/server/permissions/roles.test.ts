import { describe, expect, it } from 'vitest'
import { roleHasPrivilege } from './roles'

describe('roleHasPrivilege', () => {
  it('grants full access to OWNER and ADMIN', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      expect(roleHasPrivilege(role, 'view')).toBe(true)
      expect(roleHasPrivilege(role, 'edit')).toBe(true)
      expect(roleHasPrivilege(role, 'manage')).toBe(true)
      expect(roleHasPrivilege(role, 'admin')).toBe(true)
    }
  })

  it('limits MEMBER to view and edit', () => {
    expect(roleHasPrivilege('MEMBER', 'view')).toBe(true)
    expect(roleHasPrivilege('MEMBER', 'edit')).toBe(true)
    expect(roleHasPrivilege('MEMBER', 'manage')).toBe(false)
    expect(roleHasPrivilege('MEMBER', 'admin')).toBe(false)
  })

  it('limits VIEWER to view only', () => {
    expect(roleHasPrivilege('VIEWER', 'view')).toBe(true)
    expect(roleHasPrivilege('VIEWER', 'edit')).toBe(false)
  })
})
