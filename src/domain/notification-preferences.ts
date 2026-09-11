import type { Trip } from './logbook'
import type { NotificationTopic } from './notifications'
import {
  BOAT_NOTIFICATION_TOPICS,
  ORG_NOTIFICATION_TOPICS,
} from './notifications'

export type NotificationPreferenceCategory = 'org' | 'boat' | 'trip' | 'job'

export type NotificationPreferenceNode = {
  path: string
  label: string
  muted: boolean
  effective: boolean
  blockedBy: string | null
  blockedByLabel: string | null
}

export type ActivityEventForPreferences = {
  topic: NotificationTopic
  boatId?: string | null
  orgId?: string | null
  tripId?: string | null
}

const TOPIC_SECTION_SUFFIX: Partial<Record<NotificationTopic, string>> = {
  BOAT_PHOTOS: 'photos',
  BOAT_DOCUMENTS: 'documents',
  BOAT_ASSETS: 'assets',
  BOAT_MEMBERS: 'members',
  BOAT_CONTACTS: 'contacts',
  BOAT_SHARES: 'shares',
  BOAT_TRIPS_COMPLETED: 'trips',
  ORG_MEMBERS: 'members',
  ORG_DOCUMENTS: 'documents',
  ORG_CONTACTS: 'contacts',
  ORG_BOATS: 'boats',
}

export const NOTIFICATION_PREFERENCE_PATH_LABELS: Record<string, string> = {
  global: 'All notifications',
  org: 'Organization notifications',
  boat: 'Boat notifications',
  trip: 'Trip notifications',
  job: 'Admin job notifications',
  members: 'Members',
  documents: 'Documents',
  contacts: 'Contacts',
  boats: 'Boats',
  accounting: 'Accounting',
  photos: 'Photos',
  assets: 'Assets',
  shares: 'Shares',
  trips: 'Trips',
  stories: 'Stories',
  waypoints: 'Waypoints',
  logEntries: 'Log entries',
}

export const NOTIFICATION_CATEGORY_PATHS: NotificationPreferenceCategory[] = [
  'org',
  'boat',
  'trip',
  'job',
]

export function topicToPreferenceSectionSuffix(
  topic: NotificationTopic,
): string | null {
  return TOPIC_SECTION_SUFFIX[topic] ?? null
}

export function pathsForActivityEvent(
  input: ActivityEventForPreferences,
): string[] {
  const paths: string[] = ['global']

  if (input.topic === 'ADMIN_JOBS') {
    paths.push('job')
    return paths
  }

  if (input.tripId) {
    paths.push('trip', `trip:${input.tripId}`)
    const section = topicToPreferenceSectionSuffix(input.topic)
    if (section) {
      paths.push(`trip:${input.tripId}:${section}`)
    }
    return paths
  }

  if (input.orgId) {
    paths.push('org', `org:${input.orgId}`)
    const section = topicToPreferenceSectionSuffix(input.topic)
    if (section) {
      paths.push(`org:${input.orgId}:${section}`)
    }
    return paths
  }

  if (input.boatId) {
    paths.push('boat', `boat:${input.boatId}`)
    const section = topicToPreferenceSectionSuffix(input.topic)
    if (section) {
      paths.push(`boat:${input.boatId}:${section}`)
    }
    return paths
  }

  return paths
}

export function ancestorChainForPath(path: string): string[] {
  const chain: string[] = ['global']
  if (path === 'global') return chain

  if (
    NOTIFICATION_CATEGORY_PATHS.includes(path as NotificationPreferenceCategory)
  ) {
    return [...chain, path]
  }

  const firstColon = path.indexOf(':')
  if (firstColon === -1) return chain

  const prefix = path.slice(0, firstColon)
  if (!['org', 'boat', 'trip'].includes(prefix)) return chain

  chain.push(prefix)

  const rest = path.slice(firstColon + 1)
  const secondColon = rest.indexOf(':')
  if (secondColon === -1) {
    chain.push(path)
    return chain
  }

  const instanceId = rest.slice(0, secondColon)
  chain.push(`${prefix}:${instanceId}`)
  chain.push(path)
  return chain
}

export function computePathMuteState(
  path: string,
  mutedPaths: ReadonlySet<string>,
): {
  muted: boolean
  effective: boolean
  blockedBy: string | null
} {
  const chain = ancestorChainForPath(path)
  let blockedBy: string | null = null
  for (const segment of chain) {
    if (mutedPaths.has(segment)) {
      blockedBy = segment
      break
    }
  }
  return {
    muted: mutedPaths.has(path),
    effective: blockedBy === null,
    blockedBy,
  }
}

export function isBlockedByMute(
  mutedPaths: ReadonlySet<string>,
  chain: string[],
): { blocked: boolean; blockedBy: string | null } {
  for (const segment of chain) {
    if (mutedPaths.has(segment)) {
      return { blocked: true, blockedBy: segment }
    }
  }
  return { blocked: false, blockedBy: null }
}

export function preferencePathLabel(path: string): string {
  if (NOTIFICATION_PREFERENCE_PATH_LABELS[path]) {
    return NOTIFICATION_PREFERENCE_PATH_LABELS[path]
  }
  const parts = path.split(':')
  if (parts.length === 3) {
    const section = parts[2]
    const sectionLabel = NOTIFICATION_PREFERENCE_PATH_LABELS[section] ?? section
    return sectionLabel
  }
  if (parts.length === 2) {
    return parts[1]
  }
  return path
}

export function preferencePathForSubscription(args: {
  topic: NotificationTopic
  boatId?: string | null
  orgId?: string | null
}): string | null {
  if (args.topic === 'ADMIN_JOBS') return 'job'
  const section = topicToPreferenceSectionSuffix(args.topic)
  if (!section) return null
  if (args.orgId) return `org:${args.orgId}:${section}`
  if (args.boatId) return `boat:${args.boatId}:${section}`
  return null
}

export function orgSectionPaths(orgId: string): string[] {
  const sections = ['members', 'documents', 'contacts', 'boats', 'accounting']
  return sections.map((section) => `org:${orgId}:${section}`)
}

export function boatSectionPaths(boatId: string): string[] {
  const sections = [
    'photos',
    'documents',
    'assets',
    'accounting',
    'shares',
    'contacts',
    'members',
    'trips',
  ]
  return sections.map((section) => `boat:${boatId}:${section}`)
}

export function orgTopicForSection(section: string): NotificationTopic | null {
  const map: Record<string, NotificationTopic> = {
    members: 'ORG_MEMBERS',
    documents: 'ORG_DOCUMENTS',
    contacts: 'ORG_CONTACTS',
    boats: 'ORG_BOATS',
  }
  return map[section] ?? null
}

export function boatTopicForSection(section: string): NotificationTopic | null {
  const map: Record<string, NotificationTopic> = {
    photos: 'BOAT_PHOTOS',
    documents: 'BOAT_DOCUMENTS',
    assets: 'BOAT_ASSETS',
    members: 'BOAT_MEMBERS',
    contacts: 'BOAT_CONTACTS',
    shares: 'BOAT_SHARES',
    trips: 'BOAT_TRIPS_COMPLETED',
  }
  return map[section] ?? null
}

export function listPathsForPreferencesQuery(args: {
  boatId?: string | null
  orgId?: string | null
  includeJob?: boolean
}): string[] {
  const paths = ['global', ...NOTIFICATION_CATEGORY_PATHS]
  if (args.orgId) {
    paths.push(`org:${args.orgId}`, ...orgSectionPaths(args.orgId))
  }
  if (args.boatId) {
    paths.push(`boat:${args.boatId}`, ...boatSectionPaths(args.boatId))
  }
  if (args.includeJob === false) {
    return paths.filter((path) => path !== 'job')
  }
  return paths
}

export function orgTopicsInPreferences(): NotificationTopic[] {
  return ORG_NOTIFICATION_TOPICS
}

export function boatTopicsInPreferences(): NotificationTopic[] {
  return BOAT_NOTIFICATION_TOPICS
}

export const TRIP_PREFERENCE_SECTIONS = [
  'stories',
  'waypoints',
  'logEntries',
] as const

export function tripSectionPaths(tripId: string): string[] {
  return TRIP_PREFERENCE_SECTIONS.map((section) => `trip:${tripId}:${section}`)
}

export function tripInstancePaths(tripIds: string[]): string[] {
  const paths: string[] = []
  for (const tripId of tripIds) {
    paths.push(`trip:${tripId}`, ...tripSectionPaths(tripId))
  }
  return paths
}

export type NotificationPreferenceTreeResources = {
  boats: { id: string; name: string }[]
  orgs: { id: string; name: string }[]
}

export function listPathsForPreferencesTree(args: {
  boatIds: string[]
  orgIds: string[]
  tripIds: string[]
  includeJob?: boolean
}): string[] {
  const paths: string[] = ['global', ...NOTIFICATION_CATEGORY_PATHS]
  for (const orgId of args.orgIds) {
    paths.push(`org:${orgId}`, ...orgSectionPaths(orgId))
  }
  for (const boatId of args.boatIds) {
    paths.push(`boat:${boatId}`, ...boatSectionPaths(boatId))
  }
  paths.push(...tripInstancePaths(args.tripIds))
  if (args.includeJob === false) {
    return paths.filter((path) => path !== 'job')
  }
  return paths
}

export function enrichPreferencePathLabel(
  path: string,
  resources: NotificationPreferenceTreeResources,
): string {
  if (NOTIFICATION_PREFERENCE_PATH_LABELS[path]) {
    return NOTIFICATION_PREFERENCE_PATH_LABELS[path]
  }
  const parts = path.split(':')
  if (parts.length === 2) {
    const [kind, id] = parts
    if (kind === 'boat') {
      return resources.boats.find((boat) => boat.id === id)?.name ?? id
    }
    if (kind === 'org') {
      return resources.orgs.find((org) => org.id === id)?.name ?? id
    }
    if (kind === 'trip') {
      return id
    }
  }
  if (parts.length === 3) {
    const [kind, id, section] = parts
    const sectionLabel = NOTIFICATION_PREFERENCE_PATH_LABELS[section] ?? section
    if (kind === 'boat') {
      const name = resources.boats.find((boat) => boat.id === id)?.name ?? id
      return `${name}: ${sectionLabel}`
    }
    if (kind === 'org') {
      const name = resources.orgs.find((org) => org.id === id)?.name ?? id
      return `${name}: ${sectionLabel}`
    }
    if (kind === 'trip') {
      return sectionLabel
    }
  }
  return preferencePathLabel(path)
}

export function partitionTripsForNotificationSettings(trips: Trip[]): {
  inProgress: Trip[]
  completed: Trip[]
} {
  const inProgress = trips.filter((trip) => trip.status === 'IN_PROGRESS')
  const completed = trips
    .filter((trip) => trip.status === 'COMPLETED')
    .sort((a, b) => {
      const aTime = a.completedAt ?? a.updatedAt
      const bTime = b.completedAt ?? b.updatedAt
      return bTime.localeCompare(aTime)
    })
  return { inProgress, completed }
}

export function tripDisplayTitle(trip: Trip): string {
  const title = trip.title?.trim()
  if (title) return title
  const boat = trip.boatName?.trim()
  if (boat) return boat
  return 'Trip'
}
