import { describe, expect, it } from 'vitest'
import { resolveAppLinkPath } from './app-link-navigation'

describe('resolveAppLinkPath', () => {
  it('maps production URLs to in-app paths', () => {
    expect(resolveAppLinkPath('https://logmaster.live/trips/abc?tab=log')).toBe(
      '/trips/abc?tab=log',
    )
  })

  it('rejects unknown hosts', () => {
    expect(resolveAppLinkPath('https://evil.example/invite/token')).toBeNull()
  })

  it('accepts relative paths on the app origin', () => {
    expect(resolveAppLinkPath('/messages?thread=1')).toBe('/messages?thread=1')
  })

  it('covers invite and notification email paths', () => {
    expect(resolveAppLinkPath('https://logmaster.live/invite/abc')).toBe(
      '/invite/abc',
    )
    expect(
      resolveAppLinkPath('https://logmaster.live/boats/x?tab=photos'),
    ).toBe('/boats/x?tab=photos')
  })
})
