import { describe, expect, it } from 'vitest'
import {
  currentReturnPath,
  isAuthRequiredPath,
  safeReturnPath,
  signInHref,
  signInSearch,
} from './sign-in-redirect'

describe('safeReturnPath', () => {
  it('defaults empty or unsafe values to home', () => {
    expect(safeReturnPath(undefined)).toBe('/')
    expect(safeReturnPath('')).toBe('/')
    expect(safeReturnPath('https://evil.example/boats')).toBe('/')
    expect(safeReturnPath('//evil.example/boats')).toBe('/')
  })

  it('keeps same-origin app paths including search', () => {
    expect(safeReturnPath('/boats')).toBe('/boats')
    expect(safeReturnPath('/boats?addBoat=true')).toBe('/boats?addBoat=true')
    expect(safeReturnPath('/orgs/abc/contacts/xyz')).toBe(
      '/orgs/abc/contacts/xyz',
    )
  })
})

describe('currentReturnPath', () => {
  it('joins pathname, search, and hash', () => {
    expect(currentReturnPath('/boats', '?addBoat=true', '#photos')).toBe(
      '/boats?addBoat=true#photos',
    )
    expect(currentReturnPath('/boats', 'addBoat=true', 'photos')).toBe(
      '/boats?addBoat=true#photos',
    )
  })
})

describe('isAuthRequiredPath', () => {
  it('requires auth for account-backed areas', () => {
    expect(isAuthRequiredPath('/boats')).toBe(true)
    expect(isAuthRequiredPath('/boats/abc/assets/1')).toBe(true)
    expect(isAuthRequiredPath('/orgs')).toBe(true)
    expect(isAuthRequiredPath('/crew')).toBe(true)
    expect(isAuthRequiredPath('/settings/notifications')).toBe(true)
    expect(isAuthRequiredPath('/admin')).toBe(true)
    expect(isAuthRequiredPath('/admin/users')).toBe(true)
  })

  it('leaves public and local-first routes alone', () => {
    expect(isAuthRequiredPath('/')).toBe(false)
    expect(isAuthRequiredPath('/trips')).toBe(false)
    expect(isAuthRequiredPath('/trips/abc')).toBe(false)
    expect(isAuthRequiredPath('/map')).toBe(false)
    expect(isAuthRequiredPath('/sign-in')).toBe(false)
    expect(isAuthRequiredPath('/invite/token')).toBe(false)
    expect(isAuthRequiredPath('/crew/invite/token')).toBe(false)
  })
})

describe('signIn helpers', () => {
  it('omits redirect for home', () => {
    expect(signInSearch('/')).toEqual({})
    expect(signInHref('/')).toBe('/sign-in')
  })

  it('encodes the return path', () => {
    expect(signInSearch('/boats?addBoat=true')).toEqual({
      redirect: '/boats?addBoat=true',
    })
    expect(signInHref('/boats?addBoat=true')).toBe(
      '/sign-in?redirect=%2Fboats%3FaddBoat%3Dtrue',
    )
  })
})
