import { expect, it } from 'vitest'
import { browserIsOnline } from './browser-online'

it('does not treat server render as offline when navigator.onLine is missing', () => {
  expect(typeof window).toBe('undefined')
  expect(browserIsOnline()).toBe(true)
})
