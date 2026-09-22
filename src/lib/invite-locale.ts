/** App UI / invite email locale codes (keep in sync with `languages` in i18n). */
export const INVITE_LOCALE_CODES = [
  'ar',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'ja',
  'ko',
  'nl',
  'pt',
  'sv',
  'tr',
  'vi',
  'yue',
  'zh',
] as const

export type InviteLocale = (typeof INVITE_LOCALE_CODES)[number]

export function normalizeInviteLocale(
  raw: unknown,
  fallback: InviteLocale = 'en',
): InviteLocale {
  if (typeof raw !== 'string') return fallback
  const code = raw.trim().toLowerCase().replaceAll('_', '-')
  if (code === 'zh-hk' || code === 'zh-mo' || code.startsWith('yue')) {
    return 'yue'
  }
  if (code.startsWith('zh')) return 'zh'
  const prefix = code.split('-')[0]
  return INVITE_LOCALE_CODES.includes(prefix as InviteLocale)
    ? (prefix as InviteLocale)
    : fallback
}
