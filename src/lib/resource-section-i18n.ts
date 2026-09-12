import type { ContactResourceArea } from '../domain/contact'
import type { OrgMemberRole } from '../domain/org'
import type { NotificationTopic } from '../domain/notifications'
import type { TranslationKey, TranslationVars } from './i18n'

const RESOURCE_SECTION_KEYS: Record<string, TranslationKey> = {
  photos: 'photos',
  documents: 'documents',
  assets: 'assets',
  accounting: 'accounting',
  shares: 'shares',
  contacts: 'contacts',
  members: 'members',
  boats: 'boats',
  trips: 'trips',
  logEntries: 'logEntries',
}

export function translateResourceSection(
  section: string,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
  fallback: string,
): string {
  const key = RESOURCE_SECTION_KEYS[section]
  return key ? t(key) : fallback
}

const PREFERENCE_PATH_KEYS: Record<string, TranslationKey> = {
  job: 'adminJobNotifications',
}

export function translatePreferencePathLabel(
  path: string,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
  fallback: string,
): string {
  const exact = PREFERENCE_PATH_KEYS[path]
  if (exact) return t(exact)
  const parts = path.split(':')
  const section = parts.length >= 3 ? parts[parts.length - 1] : path
  return translateResourceSection(section, t, fallback)
}

const MEMBER_ROLE_KEYS: Record<OrgMemberRole, TranslationKey> = {
  OWNER: 'roleOwner',
  ADMIN: 'roleAdmin',
  MEMBER: 'roleMember',
  VIEWER: 'roleViewer',
}

export function translateMemberRole(
  role: OrgMemberRole,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
): string {
  return t(MEMBER_ROLE_KEYS[role])
}

const CONTACT_AREA_KEYS: Record<ContactResourceArea, TranslationKey> = {
  PHOTOS: 'photos',
  DOCUMENTS: 'documents',
  ASSETS: 'assets',
  ACCOUNTING: 'accounting',
}

export function translateContactArea(
  area: ContactResourceArea,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
): string {
  return t(CONTACT_AREA_KEYS[area])
}

const NOTIFICATION_TOPIC_KEYS: Record<NotificationTopic, TranslationKey> = {
  BOAT_PHOTOS: 'photos',
  BOAT_DOCUMENTS: 'documents',
  BOAT_ASSETS: 'assets',
  BOAT_MEMBERS: 'members',
  BOAT_CONTACTS: 'contacts',
  BOAT_SHARES: 'shares',
  BOAT_TRIPS_COMPLETED: 'completedTrips',
  ORG_MEMBERS: 'members',
  ORG_DOCUMENTS: 'documents',
  ORG_CONTACTS: 'contacts',
  ORG_BOATS: 'boats',
  ADMIN_JOBS: 'adminJobs',
}

export function translateNotificationTopic(
  topic: NotificationTopic,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
): string {
  return t(NOTIFICATION_TOPIC_KEYS[topic])
}
