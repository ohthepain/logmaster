// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExpiredInviteContinue } from './ExpiredInviteContinue'

const magicLink = vi.fn()

vi.mock('../lib/auth-client', () => ({
  signIn: {
    magicLink: (...args: unknown[]) => magicLink(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

afterEach(() => {
  cleanup()
  magicLink.mockReset()
})

it('prefills the invited email and sends a sign-up or verification link', async () => {
  magicLink.mockResolvedValue({ error: null })
  render(<ExpiredInviteContinue email="wife@example.com" />)
  const input = screen.getByRole('textbox', { name: 'Email' })
  expect(input).toHaveProperty('value', 'wife@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }))
  await waitFor(() => {
    expect(magicLink).toHaveBeenCalledWith({
      email: 'wife@example.com',
      callbackURL: '/',
    })
  })
})

it('does not send a link to a different address than the invite', () => {
  render(<ExpiredInviteContinue email="wife@example.com" />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'other@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }))
  expect(magicLink).not.toHaveBeenCalled()
})
