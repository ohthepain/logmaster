import { resolveLmmapRequest } from './lmmap-url'
import { getTripMapTile } from './tile-idb'

type LoadLmmapDeps = {
  readTile: (key: string) => Promise<ArrayBuffer | undefined>
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

let registering: Promise<void> | null = null

/** IndexedDB first, then the network. Misses are not written back into the pack store. */
export async function loadLmmapResource(
  url: string,
  deps: LoadLmmapDeps,
): Promise<ArrayBuffer> {
  const target = resolveLmmapRequest(url)
  if (!target) throw new Error(`Unrecognized map resource ${url}`)

  try {
    const stored = await deps.readTile(target)
    if (stored) return stored
  } catch {
    /* Storage can be unavailable. The network copy still loads. */
  }

  const response = await (deps.fetchImpl ?? fetch)(target, {
    signal: deps.signal,
  })
  if (!response.ok) {
    throw new Error(`Map resource ${response.status}`)
  }
  return response.arrayBuffer()
}

/** Load MapLibre only when a chart is opened. Importing this module must not. */
export function registerLmmapProtocol(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (registering) return registering
  registering = import('maplibre-gl')
    .then((maplibregl) => {
      maplibregl.default.addProtocol('lmmap', async (params, abortController) => {
        const data = await loadLmmapResource(params.url, {
          readTile: getTripMapTile,
          signal: abortController.signal,
        })
        return { data }
      })
    })
    .catch((error: unknown) => {
      registering = null
      throw error
    })
  return registering
}
