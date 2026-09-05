import type { Media } from '../domain/logbook'

export const NOTE_ORDER_KEY = 'noteOrder'
export const VOICE_ORDER_KEY = 'voiceOrder'

export type OrderedEntryContentKind = 'photo' | 'note' | 'voice'

export type OrderedEntryContentBlock = {
  key: string
  kind: OrderedEntryContentKind
  order: number
}

export function readNoteOrder(
  data: Record<string, unknown> | null | undefined,
): number | null {
  return readOrderValue(data?.[NOTE_ORDER_KEY])
}

export function readVoiceOrder(
  data: Record<string, unknown> | null | undefined,
): number | null {
  return readOrderValue(data?.[VOICE_ORDER_KEY])
}

export function withNoteOrder(
  data: Record<string, unknown> | null | undefined,
  order: number | null,
): Record<string, unknown> | null {
  const next = { ...(data ?? {}) }
  if (order == null) {
    delete next[NOTE_ORDER_KEY]
  } else {
    next[NOTE_ORDER_KEY] = order
  }
  return Object.keys(next).length > 0 ? next : null
}

export function withVoiceOrder(
  data: Record<string, unknown> | null | undefined,
  order: number | null,
): Record<string, unknown> | null {
  const next = { ...(data ?? {}) }
  if (order == null) {
    delete next[VOICE_ORDER_KEY]
  } else {
    next[VOICE_ORDER_KEY] = order
  }
  return Object.keys(next).length > 0 ? next : null
}

export function mediaOrder(media: Pick<Media, 'order'>): number {
  return media.order ?? 0
}

export function maxContentOrder(input: {
  media?: Array<Pick<Media, 'order'>>
  noteOrder?: number | null
  voiceOrder?: number | null
  draftPhotoOrder?: number | null
}): number {
  const values = [
    ...(input.media ?? []).map((item) => mediaOrder(item)),
    input.noteOrder,
    input.voiceOrder,
    input.draftPhotoOrder,
  ].filter((value): value is number => typeof value === 'number')

  if (values.length === 0) return 0
  return Math.max(...values)
}

export function nextContentOrder(input: {
  media?: Array<Pick<Media, 'order'>>
  noteOrder?: number | null
  voiceOrder?: number | null
  draftPhotoOrder?: number | null
}): number {
  return maxContentOrder(input) + 1
}

export function sortContentBlocksByOrderDesc<T extends OrderedEntryContentBlock>(
  blocks: T[],
): T[] {
  return [...blocks].sort((a, b) => {
    if (b.order !== a.order) return b.order - a.order
    return a.key.localeCompare(b.key)
  })
}

function readOrderValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
