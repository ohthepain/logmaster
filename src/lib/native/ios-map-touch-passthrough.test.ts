// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyIosNativeMapDocumentUnderlay,
  IOS_NATIVE_MAP_UNDERLAY_ATTR,
} from './ios-map-touch-passthrough'

describe('applyIosNativeMapDocumentUnderlay', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(IOS_NATIVE_MAP_UNDERLAY_ATTR)
    document.documentElement.style.backgroundColor = ''
    document.body.style.backgroundColor = ''
  })

  it('clears html and body so a native map can show through', () => {
    document.documentElement.style.backgroundColor = 'rgb(255, 255, 255)'
    document.body.style.backgroundColor = 'rgb(255, 255, 255)'

    const restore = applyIosNativeMapDocumentUnderlay()

    expect(
      document.documentElement.hasAttribute(IOS_NATIVE_MAP_UNDERLAY_ATTR),
    ).toBe(true)
    expect(document.documentElement.style.backgroundColor).toBe('transparent')
    expect(document.body.style.backgroundColor).toBe('transparent')

    restore()

    expect(
      document.documentElement.hasAttribute(IOS_NATIVE_MAP_UNDERLAY_ATTR),
    ).toBe(false)
    expect(document.documentElement.style.backgroundColor).toBe(
      'rgb(255, 255, 255)',
    )
    expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)')
  })
})
