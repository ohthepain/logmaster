import type { BoatNetworkKey } from './asset-connections'
import {
  BOAT_NETWORK_DEFINITIONS,
  BOAT_NETWORK_KEYS,
} from './asset-connections'

export type ProductNetworkConnection = {
  networkKey: BoatNetworkKey
  portCount: number | null
}

const NETWORK_PATTERNS: ReadonlyArray<{
  key: BoatNetworkKey
  pattern: RegExp
}> = [
  { key: 'seatal_kng', pattern: /seatalk\s*ng|seatalkng|\bstng\b/gi },
  { key: 'seatal_k1', pattern: /seatalk\s*1|seatalk1/gi },
  { key: 'nmea_2000', pattern: /nmea\s*-?2000|nmea2000|\bn2k\b/gi },
  { key: 'ethernet', pattern: /\bethernet\b|\braynet\b/gi },
]

function clampPortCount(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  const count = Math.floor(value)
  return count > 0 && count <= 32 ? count : null
}

function portCountBefore(prefix: string) {
  const trimmed = prefix.replace(/[\s,;:/|-]+$/g, '')
  const withTimes = trimmed.match(/(\d+)\s*[x×]\s*$/i)
  if (withTimes) return clampPortCount(Number(withTimes[1]))
  const clause = trimmed.split(/[;,/]| and /i).pop() ?? ''
  const bare = clause.trim().match(/^(\d+)$/)
  return bare ? clampPortCount(Number(bare[1])) : null
}

function keepRicherCount(
  current: number | null | undefined,
  next: number | null,
) {
  if (next == null) return current ?? null
  if (current == null || next > current) return next
  return current
}

export function parseProductNetworkConnections(
  specifications: Array<{ name: string; value: string; unit?: string | null }>,
  extra: Array<{ networkKey?: string; portCount?: number | null }> = [],
): ProductNetworkConnection[] {
  const found = new Map<BoatNetworkKey, number | null>()
  const text = specifications
    .map((spec) => `${spec.name} ${spec.value}`)
    .join('\n')
  for (const { key, pattern } of NETWORK_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      found.set(
        key,
        keepRicherCount(found.get(key), portCountBefore(text.slice(0, match.index))),
      )
    }
  }
  for (const item of extra) {
    if (!BOAT_NETWORK_KEYS.includes(item.networkKey as BoatNetworkKey)) continue
    const key = item.networkKey as BoatNetworkKey
    found.set(
      key,
      keepRicherCount(found.get(key), clampPortCount(item.portCount)),
    )
  }
  return BOAT_NETWORK_DEFINITIONS.filter((item) => found.has(item.key)).map(
    (item) => ({
      networkKey: item.key,
      portCount: found.get(item.key) ?? null,
    }),
  )
}

export function boatNetworkName(key: BoatNetworkKey) {
  return BOAT_NETWORK_DEFINITIONS.find((item) => item.key === key)?.name ?? key
}

export function productNetworkLabel(connection: ProductNetworkConnection) {
  const name = boatNetworkName(connection.networkKey)
  return connection.portCount ? `${connection.portCount} × ${name}` : name
}

export function productNetworkConnectionReason(
  connection: ProductNetworkConnection,
) {
  const name = boatNetworkName(connection.networkKey)
  if (connection.portCount && connection.portCount > 1) {
    return `Product has ${connection.portCount} × ${name} connections`
  }
  return `Product has a ${name} connection`
}
