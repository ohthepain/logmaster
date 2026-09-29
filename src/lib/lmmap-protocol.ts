import maplibregl from 'maplibre-gl'
import { resolveLmmapRequest } from './lmmap-url'
import { getTripMapTile } from './tile-idb'

type LoadLmmapDeps = {
  readTile: (key: string) => Promise<ArrayBuffer | undefined>
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

let registered = false

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

export function registerLmmapProtocol() {
  if (registered || typeof window === 'undefined') return
  registered = true
  maplibregl.addProtocol('lmmap', async (params, abortController) => {
    const data = await loadLmmapResource(params.url, {
      readTile: getTripMapTile,
      signal: abortController.signal,
    })
    return { data }
  })
}
