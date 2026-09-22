// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BoatActivityContent } from './BoatChatActivity'
import { I18nProvider, useTranslation, languages } from '../lib/i18n'
import { boatActivityCopy } from '../lib/boat-activity-copy'
import type { BoatChatActivity } from '../domain/boat-activity'

vi.mock('./PdfDocumentPages', () => ({
  PdfDocumentPages: ({ maxPages }: { maxPages?: number }) => (
    <div data-testid="pdf-preview">{maxPages}</div>
  ),
}))
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ translations: {} }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  )
  localStorage.setItem('language', 'en')
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})
const activity: BoatChatActivity = {
  id: 'event',
  kind: 'ASSET_CONNECTED',
  label: 'Engine',
  targetLabel: 'Display',
  preview: null,
}
function LanguageSwitch() {
  const { setLanguage } = useTranslation()
  return <button onClick={() => setLanguage('sv')}>Swedish</button>
}
it('translates existing activity immediately when the language changes', async () => {
  render(
    <I18nProvider>
      <LanguageSwitch />
      <BoatActivityContent activity={activity} />
    </I18nProvider>,
  )
  await screen.findByText(/Assets connected.*Engine.*Display/)
  fireEvent.click(screen.getByRole('button', { name: 'Swedish' }))
  await screen.findByText(/Utrustning ansluten.*Engine.*Display/)
  expect(screen.queryByText(/Assets connected/)).toBeNull()
})
it('has every label in all supported languages', () => {
  for (const language of languages) {
    const labels = Object.values(boatActivityCopy(language.code))
    expect(labels).toHaveLength(26)
    expect(labels.every(Boolean)).toBe(true)
  }
})
it('shows media at message size and handles removed files gracefully', async () => {
  const { container } = render(
    <I18nProvider>
      <BoatActivityContent
        activity={{
          ...activity,
          kind: 'MEDIA_ADDED',
          preview: { kind: 'image', title: 'Sunset', url: '/api/preview' },
        }}
      />
    </I18nProvider>,
  )
  const photo = await screen.findByRole('img', { name: 'Sunset' })
  expect(container.querySelector('.w-72')).not.toBeNull()
  fireEvent.error(photo)
  await screen.findByText('File no longer available')
  expect(screen.queryByRole('img')).toBeNull()
})
