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
  expect((await screen.findByText(/Assets connected/)).textContent).toBe(
    'Assets connected · Engine ↔ Display',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Swedish' }))
  expect((await screen.findByText(/Utrustning ansluten/)).textContent).toBe(
    'Utrustning ansluten · Engine ↔ Display',
  )
  expect(screen.queryByText(/Assets connected/)).toBeNull()
})
it('has every label in all supported languages', () => {
  for (const language of languages) {
    const labels = Object.values(boatActivityCopy(language.code))
    expect(labels).toHaveLength(32)
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

it('shows member names with email tooltips and translated role changes', async () => {
  render(
    <I18nProvider>
      <LanguageSwitch />
      <BoatActivityContent
        activity={{
          ...activity,
          kind: 'MEMBER_UPDATED',
          label: 'Alex',
          targetLabel: null,
          memberEmail: 'alex@example.test',
          previousMemberRole: 'MEMBER',
          memberRole: 'ADMIN',
        }}
      />
    </I18nProvider>,
  )
  expect((await screen.findByText('Alex')).title).toBe('alex@example.test')
  await screen.findByText(/Member role changed/)
  await screen.findByText(/Member → Admin/)
  expect(screen.queryByText('alex@example.test')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Swedish' }))
  await screen.findByText(/Medlemsroll ändrad/)
  await screen.findByText(/Medlem → Administratör/)
})
it('renders legacy member events without inventing a historical role', async () => {
  render(
    <I18nProvider>
      <BoatActivityContent
        activity={{
          ...activity,
          kind: 'MEMBER_UPDATED',
          label: 'Alex',
          targetLabel: null,
        }}
      />
    </I18nProvider>,
  )
  await screen.findByText(/Member updated/)
  expect(screen.getByText('Alex').hasAttribute('title')).toBe(false)
  expect(screen.queryByText(/→/)).toBeNull()
})
it('shows the assigned role when adding a member', async () => {
  render(
    <I18nProvider>
      <BoatActivityContent
        activity={{
          ...activity,
          kind: 'MEMBER_ADDED',
          label: 'Alex',
          targetLabel: null,
          memberRole: 'VIEWER',
        }}
      />
    </I18nProvider>,
  )
  await screen.findByText(/Member added/)
  await screen.findByText(/Viewer/)
})
