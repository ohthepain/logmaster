export const CARD_LANGUAGES = [
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
export const MAX_CARD_BYTES = 10 * 1024 * 1024
export type CardSummary = {
  id: string
  title: string
  checksum: string
  enabled: boolean
}
export type ImageResponseCard = {
  version: 1
  type: 'image-response'
  card: CardSummary
}
export type CardExpression = {
  id: string
  language: string
  text: string
  cards: CardSummary[]
}
/** Whole phrases, ignoring case, surrounding punctuation and repeated whitespace. */
export function normalizeCardExpression(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
    .replace(/\s+/gu, ' ')
}
