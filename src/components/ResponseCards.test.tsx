// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResponseCardSuggestions, MessageResponseCard } from './ResponseCards'

const mocks = vi.hoisted(() => ({ api: vi.fn(), language: 'sv' }))
vi.mock('../lib/api-client', () => ({ apiJson: mocks.api }))
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ language: mocks.language }),
}))
const card = {
  id: 'card',
  title: 'Absolutely',
  checksum: 'a'.repeat(64),
  enabled: true,
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.api.mockResolvedValue({ cards: [card], translationUnavailable: false })
})
afterEach(cleanup)
it('debounces localized matching and invokes the send callback on a tap', async () => {
  const select = vi.fn()
  const { rerender } = render(
    <ResponseCardSuggestions text="j" onSelect={select} disabled={false} />,
  )
  rerender(
    <ResponseCardSuggestions text="ja" onSelect={select} disabled={false} />,
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Choose Absolutely' }),
  )
  expect(select).toHaveBeenCalledWith(card)
  expect(mocks.api).toHaveBeenCalledOnce()
  expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toEqual({
    language: 'sv',
    text: 'ja',
  })
})
it('ignores a stale response after the draft changes', async () => {
  let resolve!: (value: unknown) => void
  mocks.api.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r
    }),
  )
  const { rerender } = render(
    <ResponseCardSuggestions text="yes" onSelect={vi.fn()} disabled={false} />,
  )
  await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce())
  rerender(
    <ResponseCardSuggestions text="" onSelect={vi.fn()} disabled={false} />,
  )
  resolve({ cards: [card], translationUnavailable: false })
  await Promise.resolve()
  expect(screen.queryByRole('button', { name: 'Choose Absolutely' })).toBeNull()
})
it('renders sent cards through the authenticated image endpoint', () => {
  render(
    <MessageResponseCard
      responseCard={{ version: 1, type: 'image-response', card }}
    />,
  )
  expect(screen.getByAltText('Absolutely').getAttribute('src')).toContain(
    '/api/messaging/cards/card/image',
  )
})

it('hides suggestions immediately on added characters, backspace and clearing', async () => {
  const onSelect = vi.fn()
  const { rerender } = render(
    <ResponseCardSuggestions text="ok" onSelect={onSelect} disabled={false} />,
  )
  const option = await screen.findByRole('button', {
    name: 'Choose Absolutely',
  })
  expect(option.className).not.toContain('border-slate')
  for (const text of ['okx', 'o', '']) {
    rerender(
      <ResponseCardSuggestions
        text={text}
        onSelect={onSelect}
        disabled={false}
      />,
    )
    expect(
      screen.queryByRole('button', { name: 'Choose Absolutely' }),
    ).toBeNull()
  }
})
