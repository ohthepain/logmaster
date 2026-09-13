import type { productUiCopy } from './product-ui-copy'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import englishCatalog from './locales/en'
import { apiUrl } from './app-origin'

export type TranslationKey =
  | keyof typeof productUiCopy
  | 'language'
  | 'english'
  | 'swedish'
  | 'vietnamese'
  | 'spanish'
  | 'french'
  | 'dutch'
  | 'german'
  | 'portuguese'
  | 'greek'
  | 'turkish'
  | 'cantonese'
  | 'mandarin'
  | 'japanese'
  | 'korean'
  | 'finnish'
  | 'danish'
  | 'arabic'
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
  | 'notificationSettings'
  | 'pauseAllNotifications'
  | 'resumeAllNotifications'
  | 'openNotificationSettings'
  | 'allNotificationsPaused'
  | 'allNotificationsResumed'
  | 'failedToUpdateNotifications'
  | 'tripCountOne'
  | 'tripCountOther'
  | 'boatCountOne'
  | 'boatCountOther'
  | 'crewCountOne'
  | 'crewCountOther'
  | 'contactCountOne'
  | 'contactCountOther'
  | 'memberCountOne'
  | 'memberCountOther'
  | 'entryCountOne'
  | 'entryCountOther'
  | 'tripOptions'
  | 'tripOptionsFor'
  | 'routeOptions'
  | 'routeOptionsFor'
  | 'newTrip'
  | 'importTripOrRoute'
  | 'importGpxFromUrl'
  | 'zoomIn'
  | 'zoomOut'
  | 'centerOnYourLocation'
  | 'centerOnBoatPosition'
  | 'openFullScreenMap'
  | 'mapLayers'
  | 'logEntry'
  | 'fitRoute'
  | 'startRecording'
  | 'pauseRecording'
  | 'closeReplayAndReturnToMap'
  | 'showPlannedRoute'
  | 'changePlannedRouteOverlay'
  | 'startAutoTestReplay'
  | 'editRouteCover'
  | 'addWaypointOnMap'
  | 'tripEditOptions'
  | 'uploadPhotosAndVideo'
  | 'uploading'
  | 'trackStories'
  | 'addWaypoint'
  | 'editWaypoints'
  | 'editTripCover'
  | 'tracks'
  | 'timelineTracks'
  | 'showOnTimeline'
  | 'noGraphDataForSelectedTracks'
  | 'logEntries'
  | 'media'
  | 'logShort'
  | 'timeZoom'
  | 'plannedRouteOverlayHint'
  | 'hideOverlay'
  | 'hideTripInfo'
  | 'showTripInfo'
  | 'noDataAtThisPoint'
  | 'fieldTime'
  | 'fieldPosition'
  | 'fieldHeading'
  | 'fieldElevation'
  | 'fieldSpeedOverGround'
  | 'fieldSpeedThroughWater'
  | 'fieldWaterTemperature'
  | 'fieldCourseOverGround'
  | 'fieldWind'
  | 'fieldDepth'
  | 'fieldEngine'
  | 'fieldBattery'
  | 'fieldSpeedOverGroundGps'
  | 'fieldHeartRate'
  | 'fieldCadence'
  | 'fieldAmbientTemperature'
  | 'fieldPower'
  | 'fieldDistance'
  | 'add'
  | 'photos'
  | 'documents'
  | 'assets'
  | 'accounting'
  | 'shares'
  | 'contacts'
  | 'members'
  | 'boatSections'
  | 'orgSections'
  | 'organizations'
  | 'routes'
  | 'startTrip'
  | 'openingMap'
  | 'loadingOrganization'
  | 'loadingBoat'
  | 'loadingBoats'
  | 'loadingOrganizations'
  | 'signInToManageOrgs'
  | 'signInToManageBoats'
  | 'noTripsYet'
  | 'noTripsYetDescription'
  | 'importTrack'
  | 'routeMap'
  | 'plannedRoute'
  | 'inProgress'
  | 'planned'
  | 'weekCountOne'
  | 'weekCountOther'
  | 'dayCountOne'
  | 'dayCountOther'
  | 'waypointCountOne'
  | 'waypointCountOther'
  | 'pendingCount'
  | 'expiresOn'
  | 'invite'
  | 'inviteLink'
  | 'resendInvite'
  | 'copyLink'
  | 'assetLinkCopied'
  | 'refresh'
  | 'remove'
  | 'cancel'
  | 'delete'
  | 'deleteNamed'
  | 'save'
  | 'saving'
  | 'sending'
  | 'edit'
  | 'uploadDocument'
  | 'addLink'
  | 'addContact'
  | 'addPhotos'
  | 'addAsset'
  | 'addAssetPhotoTooLarge'
  | 'addAssetIdentifyLowConfidence'
  | 'addAssetIdentifyCheckModel'
  | 'addAssetIdentifyNoModelFound'
  | 'addAssetIdentifyFailedFallback'
  | 'addAssetCameraUnavailable'
  | 'addAssetEnterNameForResearch'
  | 'addAssetNoResearchResults'
  | 'addAssetSuggestionsUnavailable'
  | 'addAssetUpdateExistingFailed'
  | 'addAssetSaveFailed'
  | 'addAssetStatusIdentifying'
  | 'addAssetStatusSaving'
  | 'addAssetStatusUpdating'
  | 'addAssetStatusOpeningCamera'
  | 'addAssetExistingOnBoat'
  | 'addAssetExistingOnBoatHelp'
  | 'open'
  | 'overwrite'
  | 'merge'
  | 'close'
  | 'addAssetTakePhoto'
  | 'addAssetSelectPhoto'
  | 'addAssetChoosePhoto'
  | 'addAssetPhotoAriaLabel'
  | 'addAssetAutoIdentify'
  | 'addAssetPhotoAlt'
  | 'addAssetRetryIdentification'
  | 'addAssetRemovePhoto'
  | 'labelName'
  | 'labelDescription'
  | 'labelModelNumber'
  | 'confirmModelNumber'
  | 'noModelNumber'
  | 'addAssetConfirmModelBeforeSave'
  | 'labelCategory'
  | 'uncategorized'
  | 'findDocuments'
  | 'addAssetResearching'
  | 'addAssetResearchingBackground'
  | 'assetResearchInProgress'
  | 'assetResearchComplete'
  | 'assetResearchFailed'
  | 'confirmSelectedConnections'
  | 'assetResearchConnectionsSaved'
  | 'suggestedDownloads'
  | 'suggestedDownloadsHint'
  | 'assetLinks'
  | 'downloadAndAttach'
  | 'attached'
  | 'working'
  | 'removeAssetLink'
  | 'removeAssetLinkConfirm'
  | 'removeAssetConnectionConfirm'
  | 'possibleConnections'
  | 'possibleConnectionsHint'
  | 'existingAsset'
  | 'dismissSuggestion'
  | 'labelOwnership'
  | 'ownershipUser'
  | 'ownershipExternal'
  | 'ownershipOrg'
  | 'labelOwnedBy'
  | 'selectMember'
  | 'labelInstalledDate'
  | 'addAccount'
  | 'addTransaction'
  | 'addPurchase'
  | 'addOwner'
  | 'addLabel'
  | 'editLabel'
  | 'addOrganization'
  | 'noDocumentsYet'
  | 'noPhotosYet'
  | 'noAssetsYet'
  | 'noMembersYet'
  | 'noContactsYet'
  | 'noOwnersAssigned'
  | 'noBoatsInOrg'
  | 'noBoatsYet'
  | 'noBoatsYetDescription'
  | 'noOrganizationsYet'
  | 'noOrganizationsYetDescription'
  | 'numberOfShares'
  | 'updateCount'
  | 'shareCountOnBoatOne'
  | 'shareCountOnBoatOther'
  | 'shareNumber'
  | 'moveShareUp'
  | 'moveShareDown'
  | 'orgBankBalance'
  | 'noOrgBankAccount'
  | 'attachBoatToOrgForAccounting'
  | 'purchases'
  | 'noPurchasesRecorded'
  | 'expenseClaims'
  | 'noExpenseClaims'
  | 'transactions'
  | 'noTransactionsYet'
  | 'noTransactionsOnBoat'
  | 'bankAccounts'
  | 'noBankAccountsYet'
  | 'openingBalanceAmount'
  | 'editOpeningBalance'
  | 'orgContacts'
  | 'addressBookOnly'
  | 'changeOrganizationImage'
  | 'addOrganizationImage'
  | 'changeMapIcon'
  | 'stopNotificationsFor'
  | 'notifyWhenSectionChanges'
  | 'completedTrips'
  | 'adminJobs'
  | 'roleOwner'
  | 'roleAdmin'
  | 'roleMember'
  | 'roleViewer'
  | 'pending'
  | 'documentOptionsFor'
  | 'onlyAdminsManageMembers'
  | 'orgNamed'
  | 'defaultPhoto'
  | 'setAsDefaultPhoto'
  | 'friends'
  | 'noFriendsYet'
  | 'friend'
  | 'connected'
  | 'invitePending'
  | 'localCrew'
  | 'adminJobNotifications'
export type TranslationCatalog = Record<TranslationKey, string>
export type TranslationVars = Record<string, string | number>

export function interpolateTranslation(
  template: string,
  vars?: TranslationVars,
): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name]
    return value == null ? match : String(value)
  })
}

/** Register a locale here after adding its lazy-loaded catalog module. */
export const languages = [
  {
    code: 'ar',
    nameKey: 'arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    load: () => import('./locales/ar'),
  },
  {
    code: 'da',
    nameKey: 'danish',
    nativeName: 'Dansk',
    flag: '🇩🇰',
    load: () => import('./locales/da'),
  },
  {
    code: 'de',
    nameKey: 'german',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    load: () => import('./locales/de'),
  },
  {
    code: 'el',
    nameKey: 'greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    load: () => import('./locales/el'),
  },
  {
    code: 'en',
    nameKey: 'english',
    nativeName: 'English',
    flag: '🇬🇧',
    load: () => import('./locales/en'),
  },
  {
    code: 'es',
    nameKey: 'spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    load: () => import('./locales/es'),
  },
  {
    code: 'fi',
    nameKey: 'finnish',
    nativeName: 'Suomi',
    flag: '🇫🇮',
    load: () => import('./locales/fi'),
  },
  {
    code: 'fr',
    nameKey: 'french',
    nativeName: 'Français',
    flag: '🇫🇷',
    load: () => import('./locales/fr'),
  },
  {
    code: 'ja',
    nameKey: 'japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    load: () => import('./locales/ja'),
  },
  {
    code: 'ko',
    nameKey: 'korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    load: () => import('./locales/ko'),
  },
  {
    code: 'nl',
    nameKey: 'dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    load: () => import('./locales/nl'),
  },
  {
    code: 'pt',
    nameKey: 'portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    load: () => import('./locales/pt'),
  },
  {
    code: 'sv',
    nameKey: 'swedish',
    nativeName: 'Svenska',
    flag: '🇸🇪',
    load: () => import('./locales/sv'),
  },
  {
    code: 'tr',
    nameKey: 'turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    load: () => import('./locales/tr'),
  },
  {
    code: 'vi',
    nameKey: 'vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    load: () => import('./locales/vi'),
  },
  {
    code: 'yue',
    nameKey: 'cantonese',
    nativeName: '廣東話',
    flag: '🇭🇰',
    load: () => import('./locales/yue'),
  },
  {
    code: 'zh',
    nameKey: 'mandarin',
    nativeName: '普通话',
    flag: '🇨🇳',
    load: () => import('./locales/zh'),
  },
] as const
export type Language = (typeof languages)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'language'

function matchBrowserLanguage(tag: string): Language | undefined {
  const normalized = tag.toLowerCase().replaceAll('_', '-')
  const exact = languages.find((item) => item.code === normalized)?.code
  if (exact) return exact
  if (
    normalized.startsWith('zh-hk') ||
    normalized.startsWith('zh-mo') ||
    normalized.startsWith('yue')
  ) {
    return 'yue'
  }
  if (normalized.startsWith('zh')) return 'zh'
  const prefix = normalized.split('-')[0]
  return languages.find((item) => item.code === prefix)?.code
}

function preferredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  const storedLanguage = languages.find((item) => item.code === stored)?.code
  if (storedLanguage) return storedLanguage
  return matchBrowserLanguage(navigator.language) ?? 'en'
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
  t: (key: TranslationKey, vars?: TranslationVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start from the server-rendered English catalog, then switch after
  // hydration so locale-dependent labels never cause a hydration mismatch.
  const [language, setLanguageState] = useState<Language>('en')
  const [catalog, setCatalog] = useState<TranslationCatalog>(englishCatalog)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setLanguageState(preferredLanguage())
    setHydrated(true)
  }, [])

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
    if (!hydrated) return
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [hydrated, language])

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      loading,
      setLanguage: setLanguageState,
      t: (key, vars) =>
        interpolateTranslation(catalog[key] ?? englishCatalog[key], vars),
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
