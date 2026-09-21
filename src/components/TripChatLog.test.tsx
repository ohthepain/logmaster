// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider, useTranslation, languages } from '../lib/i18n'
import { tripLogCopy } from '../lib/trip-log-copy'
import { TripChatLogItem, TripChatPosition, plainTripLog } from './TripChatLog'
import type { ChatMessage } from '../domain/messaging'

vi.mock('./MessageMedia', () => ({ MessageMedia: () => null }))
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})
const message: ChatMessage = {
  id: 'message',
  threadId: 'trip:trip',
  senderId: 'captain',
  senderName: 'Captain',
  text: '',
  references: [],
  responseCard: null,
  createdAt: '2026-09-21T12:00:00Z',
  logEntry: {
    id: 'entry',
    type: 'SAILS_UP',
    timestamp: '2026-09-21T12:00:00Z',
    latitude: 59.3,
    longitude: 18.1,
    notes: null,
    legacyMedia: [],
  },
}
function SwitchLanguage() {
  const { setLanguage } = useTranslation()
  return <button onClick={() => setLanguage('sv')}>Swedish</button>
}
it('translates an already rendered event after switching languages without changing stored data', async () => {
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
  render(
    <I18nProvider>
      <SwitchLanguage />
      <TripChatLogItem userId="viewer" message={message} />
    </I18nProvider>,
  )
  await screen.findByText(/Sails raised/)
  fireEvent.click(screen.getByRole('button', { name: 'Swedish' }))
  await screen.findByText(/Seglen hissade/)
  expect(screen.queryByText(/Sails raised/)).toBeNull()
  expect(screen.getByTestId('trip-log-row').className).not.toContain('rounded')
  expect(message.logEntry!.type).toBe('SAILS_UP')
})
it('has labels for every log event in every supported language', () => {
  for (const language of languages)
    expect(Object.values(tripLogCopy(language.code))).toHaveLength(15)
  for (const language of languages)
    expect(Object.values(tripLogCopy(language.code)).every(Boolean)).toBe(true)
  expect(plainTripLog(message.logEntry!)).toBe(true)
  expect(plainTripLog({ ...message.logEntry!, type: 'MEDIA' })).toBe(false)
  expect(plainTripLog({ ...message.logEntry!, type: 'VOICE_NOTE' })).toBe(false)
})
it('keeps the position map photo-sized and preserves the position if tiles fail', async () => {
  const { container } = render(
    <TripChatPosition latitude={59.3} longitude={18.1} />,
  )
  expect(container.querySelector('figure')!.className).toContain('w-72')
  expect(screen.getByRole('img', { name: '59.3000, 18.1000' })).toBeTruthy()
  fireEvent.error(container.querySelector('img')!)
  await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(0))
  expect(screen.getByText('59.3000, 18.1000')).toBeTruthy()
})
