import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import englishCatalog from './locales/en'
import { apiUrl } from './app-origin'

export type TranslationKey =
  | 'language'
  | 'english'
  | 'swedish'
  | 'home'
  | 'profile'
  | 'profileMenu'
  | 'closeProfileMenu'
  | 'editProfile'
  | 'openYourAccount'
  | 'trips'
  | 'boats'
  | 'crew'
  | 'connections'
  | 'comingSoon'
  | 'addTrip'
  | 'addBoat'
  | 'addCrewMember'
  | 'manageTrips'
  | 'openMapToAddTrip'
  | 'manageBoats'
  | 'addABoat'
  | 'manageCrew'
  | 'addCrew'
  | 'connectionsComingSoon'
  | 'accountOptions'
  | 'orgs'
  | 'admin'
  | 'resetTutorial'
  | 'tutorialReset'
  | 'termsOfService'
  | 'privacyPolicy'
  | 'signOut'
  | 'signIn'
  | 'loading'
  | 'light'
  | 'dark'
  | 'systemTheme'
  | 'colorScheme'
  | 'pageNotFound'
  | 'unknownUrl'
  | 'backToLogmaster'
export type TranslationCatalog = Record<TranslationKey, string>

/** Register a locale here after adding its lazy-loaded catalog module. */
export const languages = [
  { code: 'en', nameKey: 'english', load: () => import('./locales/en') },
  { code: 'sv', nameKey: 'swedish', load: () => import('./locales/sv') },
] as const
export type Language = (typeof languages)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'language'

function preferredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  const storedLanguage = languages.find((item) => item.code === stored)?.code
  if (storedLanguage) return storedLanguage
  const browserLanguage = navigator.language.toLowerCase().split('-')[0]
  return languages.find((item) => item.code === browserLanguage)?.code ?? 'en'
}

async function loadCatalog(language: Language): Promise<TranslationCatalog> {
  const entry = languages.find((item) => item.code === language)
  const module = await (entry?.load() ?? languages[0].load())
  const base = module.default

  // Overrides are fetched after the lazy module so a temporary API failure
  // never prevents the app from rendering its built-in copy.
  try {
    const response = await fetch(apiUrl(`/api/translations/${language}`), {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) return base
    const data = (await response.json()) as { translations?: unknown }
    if (!data.translations || typeof data.translations !== 'object') return base
    return { ...base, ...(data.translations as Partial<TranslationCatalog>) }
  } catch {
    return base
  }
}

type I18nContextValue = {
  language: Language
  loading: boolean
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start from the server-rendered English catalog, then switch after
  // hydration so locale-dependent labels never cause a hydration mismatch.
  const [language, setLanguageState] = useState<Language>('en')
  const [catalog, setCatalog] = useState<TranslationCatalog>(englishCatalog)
  const [loading, setLoading] = useState(false)

  useEffect(() => setLanguageState(preferredLanguage()), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadCatalog(language).then((nextCatalog) => {
      if (cancelled) return
      setCatalog(nextCatalog)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [language])

  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      loading,
      setLanguage: setLanguageState,
      t: (key) => catalog[key] ?? englishCatalog[key],
    }),
    [catalog, language, loading],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useTranslation must be used within I18nProvider')
  return value
}
