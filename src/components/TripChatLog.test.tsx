// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider, useTranslation, languages } from '../lib/i18n'
import { tripLogCopy } from '../lib/trip-log-copy'
import { TripChatLogItem, TripLogContent, plainTripLog } from './TripChatLog'
import type { ChatMessage } from '../domain/messaging'
import type * as LogbookPlace from '../lib/logbook-place'

vi.mock('./MessageMedia', () => ({ MessageMedia: () => null }))
vi.mock('./TripChatPositionMap', () => ({
  TripChatPositionMap: () => <div data-testid="trip-chat-hourly-map" />,
}))
vi.mock('./PlaybackTimelineLogEntryMarker', () => ({
  PlaybackTimelineLogEntryMarker: () => <span data-testid="hourly-log-icon" />,
}))
vi.mock('../lib/logbook-place', async (importOriginal) => {
  const actual = await importOriginal<typeof LogbookPlace>()
  return {
    ...actual,
    lookupLogEntryPlace: vi.fn(async () => null),
  }
})
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
    place: null,
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
it('renders hourly logs on one row and expands the interactive map', () => {
  render(
    <I18nProvider>
      <TripLogContent
        tripId="trip"
        entry={{
          id: 'hourly',
          type: 'HOURLY_LOG',
          timestamp: '2026-09-21T14:00:00.000Z',
          latitude: 59.3,
          longitude: 18.1,
          place: {
            name: 'Stockholm',
            detail: null,
            kind: 'city',
            source: 'osm',
            distanceM: 0,
          },
          notes: 'Auto-tracked position',
          legacyMedia: [],
        }}
      />
    </I18nProvider>,
  )
  expect(screen.getByTestId('hourly-log-icon')).toBeTruthy()
  expect(screen.queryByText('Hourly log')).toBeNull()
  expect(screen.getByText('Stockholm')).toBeTruthy()
  expect(screen.getByText('59.3000, 18.1000')).toBeTruthy()
  expect(screen.queryByTestId('trip-chat-hourly-map')).toBeNull()
  expect(screen.queryByText('Auto-tracked position')).toBeNull()
  fireEvent.click(
    screen.getByRole('button', {
      name: /Stockholm.*59\.3000, 18\.1000.*Show map/,
    }),
  )
  expect(screen.getByTestId('trip-chat-hourly-map')).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', {
      name: /Stockholm.*59\.3000, 18\.1000.*Hide map/,
    }),
  )
  expect(screen.queryByTestId('trip-chat-hourly-map')).toBeNull()
})
