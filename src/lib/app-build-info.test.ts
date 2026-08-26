import { describe, expect, it } from 'vitest'
import { formatAppBuildFooter } from './app-build-info'

describe('formatAppBuildFooter', () => {
  it('shows stage with build number on native staging archives', () => {
    expect(formatAppBuildFooter('stage', '42')).toBe('stage · 42')
  })

  it('shows build label without number on web', () => {
    expect(formatAppBuildFooter('build', null)).toBe('build')
  })

  it('shows build with number on production native archives', () => {
    expect(formatAppBuildFooter('build', '7')).toBe('build · 7')
  })
})
