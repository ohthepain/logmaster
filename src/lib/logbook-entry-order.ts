import type { LogEntry } from '../domain/logbook'

export function entryCreatedAtMs(
  entry: Pick<LogEntry, 'createdAt' | 'timestamp'>,
): number {
  const ms = new Date(entry.createdAt ?? entry.timestamp).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

/** Stable log order: timestamp first, then creation time. */
export function compareLogEntriesChronologically(
  a: Pick<LogEntry, 'timestamp' | 'createdAt'>,
  b: Pick<LogEntry, 'timestamp' | 'createdAt'>,
): number {
  const timeDelta =
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  if (timeDelta !== 0) return timeDelta
  return entryCreatedAtMs(a) - entryCreatedAtMs(b)
}

export function sortLogEntriesChronologically<T extends LogEntry>(entries: T[]): T[] {
  return [...entries].sort(compareLogEntriesChronologically)
}

export function entryHasMapPosition(
  entry: Pick<LogEntry, 'deleted' | 'latitude' | 'longitude'>,
): boolean {
  return (
    !entry.deleted &&
    entry.latitude != null &&
    entry.longitude != null &&
    Number.isFinite(entry.latitude) &&
    Number.isFinite(entry.longitude)
  )
}

export function sameMapPosition(
  a: Pick<LogEntry, 'latitude' | 'longitude'>,
  b: Pick<LogEntry, 'latitude' | 'longitude'>,
): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude
}
