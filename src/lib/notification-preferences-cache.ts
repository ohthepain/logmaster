import type {
  NotificationPreferenceNode,
  NotificationPreferenceTreeResources,
} from '../domain/notification-preferences'
import {
  fetchNotificationPreferenceNode,
  fetchNotificationPreferences,
} from './notifications-api'
import {
  ensureNotificationPreferencesReady,
  getNotificationPreferenceFromStore,
  useNotificationPreferencesStore,
} from '../stores/notification-preferences'

type PreferencesScope = {
  boatId?: string
  orgId?: string
  includeJob?: boolean
}

type TreeScope = {
  tree: true
  tripIds?: string[]
  includeJob?: boolean
}

const preferencesCache = new Map<string, NotificationPreferenceNode[]>()
const preferenceNodeCache = new Map<string, NotificationPreferenceNode>()
const inflightLists = new Map<string, Promise<NotificationPreferenceNode[]>>()
const inflightNodes = new Map<string, Promise<NotificationPreferenceNode>>()

function scopeKey(scope: PreferencesScope): string {
  return [
    scope.boatId ?? '',
    scope.orgId ?? '',
    scope.includeJob === false ? '0' : '1',
  ].join('|')
}

function nodeKey(path: string): string {
  return path
}

export function invalidateNotificationPreferences(
  scope?: PreferencesScope | TreeScope,
) {
  if (!scope || ('tree' in scope && scope.tree)) {
    useNotificationPreferencesStore.getState().invalidate()
  }
  if (!scope) {
    preferencesCache.clear()
    preferenceNodeCache.clear()
    return
  }
  if ('tree' in scope && scope.tree) {
    return
  }
  preferencesCache.delete(scopeKey(scope as PreferencesScope))
}

export function invalidateNotificationPreferencePath(path: string) {
  preferenceNodeCache.delete(nodeKey(path))
  preferencesCache.clear()
  void path
}

export async function getNotificationPreferencesCached(
  scope: PreferencesScope = {},
): Promise<NotificationPreferenceNode[]> {
  const key = scopeKey(scope)
  const cached = preferencesCache.get(key)
  if (cached) return cached

  const existing = inflightLists.get(key)
  if (existing) return existing

  const promise = fetchNotificationPreferences(scope)
    .then((nodes) => {
      preferencesCache.set(key, nodes)
      return nodes
    })
    .finally(() => {
      inflightLists.delete(key)
    })
  inflightLists.set(key, promise)
  return promise
}

export async function getNotificationPreferencesTreeCached(
  scope: TreeScope,
): Promise<{
  nodes: NotificationPreferenceNode[]
  resources: NotificationPreferenceTreeResources
}> {
  void scope
  return ensureNotificationPreferencesReady()
}

export async function getNotificationPreferenceNodeCached(
  path: string,
): Promise<NotificationPreferenceNode> {
  const fromTree = getNotificationPreferenceFromStore(path)
  if (fromTree) return fromTree

  const key = nodeKey(path)
  const cached = preferenceNodeCache.get(key)
  if (cached) return cached

  const existing = inflightNodes.get(key)
  if (existing) return existing

  const promise = fetchNotificationPreferenceNode(path)
    .then((node) => {
      preferenceNodeCache.set(key, node)
      return node
    })
    .finally(() => {
      inflightNodes.delete(key)
    })
  inflightNodes.set(key, promise)
  return promise
}
