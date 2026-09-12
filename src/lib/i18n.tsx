import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Keep the English catalog as the source of truth. Adding a language is a
 * type-checked `TranslationCatalog` here and one entry in `translations`.
 */
const en = {
  language: 'Language',
  english: 'English',
  swedish: 'Swedish',
  home: 'Home',
  profile: 'Profile',
  profileMenu: 'Profile menu',
  closeProfileMenu: 'Close profile menu',
  editProfile: 'Edit profile',
  openYourAccount: 'Open your account',
  trips: 'Trips',
  boats: 'Boats',
  crew: 'Crew',
  connections: 'Connections',
  comingSoon: 'Coming soon',
  addTrip: 'Add trip',
  addBoat: 'Add boat',
  addCrewMember: 'Add crew member',
  manageTrips: 'Manage trips',
  openMapToAddTrip: 'Open map to add a trip',
  manageBoats: 'Manage boats',
  addABoat: 'Add a boat',
  manageCrew: 'Manage crew',
  addCrew: 'Add crew',
  connectionsComingSoon: 'Connections are coming soon',
  accountOptions: 'Account options',
  orgs: 'Orgs',
  admin: 'Admin',
  resetTutorial: 'Reset tutorial',
  tutorialReset: 'Tutorial reset',
  termsOfService: 'Terms of Service',
  privacyPolicy: 'Privacy Policy',
  signOut: 'Sign out',
  signIn: 'Sign in',
  loading: 'Loading…',
  light: 'Light',
  dark: 'Dark',
  systemTheme: 'System (match device)',
  colorScheme: 'Color scheme',
  pageNotFound: 'Page not found',
  unknownUrl: 'That URL does not match any route. Check the address or return home.',
  backToLogmaster: 'Back to logmaster',
} as const

export type TranslationKey = keyof typeof en
export type TranslationCatalog = Record<TranslationKey, string>

/** Add a locale here after creating its catalog below. */
export const languages = [
  { code: 'en', nameKey: 'english' },
  { code: 'sv', nameKey: 'swedish' },
] as const
export type Language = (typeof languages)[number]['code']

const sv: TranslationCatalog = {
  language: 'Språk',
  english: 'Engelska',
  swedish: 'Svenska',
  home: 'Hem',
  profile: 'Profil',
  profileMenu: 'Profilmeny',
  closeProfileMenu: 'Stäng profilmenyn',
  editProfile: 'Redigera profil',
  openYourAccount: 'Öppna ditt konto',
  trips: 'Resor',
  boats: 'Båtar',
  crew: 'Besättning',
  connections: 'Anslutningar',
  comingSoon: 'Kommer snart',
  addTrip: 'Lägg till resa',
  addBoat: 'Lägg till båt',
  addCrewMember: 'Lägg till besättningsmedlem',
  manageTrips: 'Hantera resor',
  openMapToAddTrip: 'Öppna kartan för att lägga till en resa',
  manageBoats: 'Hantera båtar',
  addABoat: 'Lägg till en båt',
  manageCrew: 'Hantera besättning',
  addCrew: 'Lägg till besättning',
  connectionsComingSoon: 'Anslutningar kommer snart',
  accountOptions: 'Kontoinställningar',
  orgs: 'Organisationer',
  admin: 'Administration',
  resetTutorial: 'Starta om introduktionen',
  tutorialReset: 'Introduktionen har startats om',
  termsOfService: 'Användarvillkor',
  privacyPolicy: 'Integritetspolicy',
  signOut: 'Logga ut',
  signIn: 'Logga in',
  loading: 'Laddar…',
  light: 'Ljust',
  dark: 'Mörkt',
  systemTheme: 'System (följ enheten)',
  colorScheme: 'Färgschema',
  pageNotFound: 'Sidan hittades inte',
  unknownUrl: 'Den här webbadressen matchar ingen sida. Kontrollera adressen eller gå tillbaka till startsidan.',
  backToLogmaster: 'Tillbaka till logmaster',
}

export const translations: Record<Language, TranslationCatalog> = { en, sv }
export const LANGUAGE_STORAGE_KEY = 'language'

function preferredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'sv') return stored
  return navigator.language.toLowerCase().startsWith('sv') ? 'sv' : 'en'
}

type I18nContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start from the server-rendered locale, then read browser preferences after
  // hydration so locale-dependent labels never cause a hydration mismatch.
  const [language, setLanguageState] = useState<Language>('en')
  useEffect(() => setLanguageState(preferredLanguage()), [])
  useEffect(() => {
    document.documentElement.lang = language
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key) => translations[language][key],
    }),
    [language],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useTranslation must be used within I18nProvider')
  return value
}
