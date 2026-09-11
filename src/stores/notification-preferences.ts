import { create } from 'zustand'
import type {
  NotificationPreferenceNode,
  NotificationPreferenceTreeResources,
} from '../domain/notification-preferences'
import { fetchNotificationPreferencesTree } from '../lib/notifications-api'

export type NotificationPreferenceTree = {
  nodes: NotificationPreferenceNode[]
  resources: NotificationPreferenceTreeResources
}

type NotificationPreferencesState = {
  tree: NotificationPreferenceTree | null
  tripIdsKey: string | null
  loading: boolean
  error: string | null
  inFlight: Promise<NotificationPreferenceTree> | null
  loadTree: (
    tripIds: string[],
    options?: { force?: boolean },
  ) => Promise<NotificationPreferenceTree>
  patchNode: (node: NotificationPreferenceNode) => void
  invalidate: () => void
}

function tripIdsKey(tripIds: string[]): string {
  return [...new Set(tripIds.filter(Boolean))].sort().join(',')
}

function nodesByPath(
  nodes: NotificationPreferenceNode[],
): Map<string, NotificationPreferenceNode> {
  return new Map(nodes.map((node) => [node.path, node]))
}

export const useNotificationPreferencesStore =
  create<NotificationPreferencesState>((set, get) => ({
    tree: null,
    tripIdsKey: null,
    loading: false,
    error: null,
    inFlight: null,

    loadTree: async (tripIds, options) => {
      const key = tripIdsKey(tripIds)
      const state = get()
      if (
        !options?.force &&
        state.tree &&
        state.tripIdsKey === key &&
        !state.loading
      ) {
        return state.tree
      }
      if (!options?.force && state.inFlight && state.tripIdsKey === key) {
        return state.inFlight
      }

      const promise = fetchNotificationPreferencesTree({ tripIds })
        .then((result) => {
          set({
            tree: result,
            tripIdsKey: key,
            loading: false,
            error: null,
            inFlight: null,
          })
          return result
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Failed to load preferences'
          set({
            loading: false,
            error: message,
            inFlight: null,
          })
          throw error
        })

      set({ loading: true, error: null, inFlight: promise, tripIdsKey: key })
      return promise
    },

    patchNode: (node) => {
      const tree = get().tree
      if (!tree) return
      const nextNodes = tree.nodes.map((existing) =>
        existing.path === node.path ? node : existing,
      )
      if (!nextNodes.some((existing) => existing.path === node.path)) {
        nextNodes.push(node)
      }
      set({ tree: { ...tree, nodes: nextNodes } })
    },

    invalidate: () => {
      set({
        tree: null,
        tripIdsKey: null,
        inFlight: null,
        loading: false,
        error: null,
      })
    },
  }))

export function getNotificationPreferenceFromStore(
  path: string,
): NotificationPreferenceNode | undefined {
  const nodes = useNotificationPreferencesStore.getState().tree?.nodes
  if (!nodes) return undefined
  return nodesByPath(nodes).get(path)
}

/** One coordinated load: logbook trips (local/bootstrapped) + single preferences tree request. */
export async function ensureNotificationPreferencesReady(options?: {
  force?: boolean
}): Promise<NotificationPreferenceTree> {
  const { useLogbookStore } = await import('./logbook')
  const logbook = useLogbookStore.getState()
  if (!logbook.booted) {
    await logbook.load()
  }
  const tripIds = useLogbookStore.getState().trips.map((trip) => trip.id)
  return useNotificationPreferencesStore.getState().loadTree(tripIds, options)
}
