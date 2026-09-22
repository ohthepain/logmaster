// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, LANGUAGE_STORAGE_KEY, useTranslation } from './i18n'

const fetchProfile = vi.fn()
const updateProfilePreferredLanguage = vi.fn()

vi.mock('./profile-api', () => ({
  fetchProfile: (...args: unknown[]) => fetchProfile(...args),
  updateProfilePreferredLanguage: (...args: unknown[]) =>
    updateProfilePreferredLanguage(...args),
}))

const useSession = vi.fn()

vi.mock('./auth-client', () => ({
  useSession: () => useSession(),
}))

function LanguageProbe() {
  const { language } = useTranslation()
  return <div data-testid="language">{language}</div>
}

describe('I18nProvider locale sync', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ translations: {} }), {
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    })
    localStorage.clear()
    fetchProfile.mockReset()
    updateProfilePreferredLanguage.mockReset().mockResolvedValue(undefined)
    useSession.mockReturnValue({ data: null })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('uses DB language when it differs from OS', async () => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    })
    useSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
    })
    fetchProfile.mockResolvedValue({ preferredLanguage: 'sv' })

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('sv')
    })
    expect(updateProfilePreferredLanguage).not.toHaveBeenCalled()
  })

  it('seeds OS language when DB is empty', async () => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    })
    useSession.mockReturnValue({
      data: { user: { id: 'user-2' } },
    })
    fetchProfile.mockResolvedValue({ preferredLanguage: null })

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('de')
    })
    expect(updateProfilePreferredLanguage).toHaveBeenCalledWith('de')
  })

  it('ignores localStorage for guests and follows OS', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr')
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    })
    useSession.mockReturnValue({ data: null })

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('en')
    })
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr')
  })

  it('mirrors language to localStorage only when signed in', async () => {
    useSession.mockReturnValue({
      data: { user: { id: 'user-3' } },
    })
    fetchProfile.mockResolvedValue({ preferredLanguage: 'sv' })

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('sv')
    })
  })
})
