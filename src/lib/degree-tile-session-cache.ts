/**
 * Session cache for 1° GeoJSON tiles. The chart refetches the viewport on
 * every pan; without this, roaming back over the same square hits the network
 * again even though the tile has not changed.
 */

const MAX_ENTRIES = 1200

type Entry = { payload: unknown }

const payloads = new Map<string, Entry>()
const appliedViewport = new Map<string, string>()

export function degreeViewportSignature(ids: string[]): string {
  return [...ids].sort().join('|')
}

export function clearDegreeTileSessionCache() {
  payloads.clear()
  appliedViewport.clear()
}

export function cachedDegreeTile(url: string): unknown | undefined {
  const entry = payloads.get(url)
  if (!entry) return undefined
  payloads.delete(url)
  payloads.set(url, entry)
  return entry.payload
}

export function storeDegreeTile(url: string, payload: unknown) {
  if (payloads.has(url)) payloads.delete(url)
  payloads.set(url, { payload })
  while (payloads.size > MAX_ENTRIES) {
    const oldest = payloads.keys().next().value
    if (oldest === undefined) break
    payloads.delete(oldest)
  }
}

export function degreeViewportAlreadyApplied(
  scope: string,
  signature: string,
): boolean {
  return appliedViewport.get(scope) === signature
}

export function markDegreeViewportApplied(scope: string, signature: string) {
  appliedViewport.set(scope, signature)
}
