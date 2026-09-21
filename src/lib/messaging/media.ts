import { apiJson } from '../api-client'
import { apiUrl } from '../app-origin'
import {
  messageMediaType,
  validateMessageFile,
} from '../../domain/message-media'
import type { ChatAttachment } from '../../domain/message-media'

const CACHE_PREFIX = 'logmaster-message-media-v1-'
const MAX_CACHE_BYTES = 200 * 1024 * 1024
const hashes = new WeakMap<File, Promise<string>>()
const downloads = new Map<string, Promise<Blob>>()
let cacheWrites = Promise.resolve()
export async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
export async function uploadMessageFiles(
  threadId: string,
  files: File[],
  progress: (value: string) => void,
  logTripId?: string,
): Promise<ChatAttachment[]> {
  const media: ChatAttachment[] = []
  for (const [index, file] of files.entries()) {
    validateMessageFile(file, !!logTripId)
    progress(`Preparing ${index + 1} of ${files.length}…`)
    if (!hashes.has(file)) hashes.set(file, sha256(file))
    const checksum = await hashes.get(file)!
    if (media.some((item) => item.checksum === checksum)) continue
    const base = logTripId
      ? `/api/logbook/trips/${encodeURIComponent(logTripId)}/media`
      : `/api/messaging/threads/${encodeURIComponent(threadId)}/media`
    const prepared = await apiJson<{
      media: ChatAttachment
      upload: null | { url: string; headers: Record<string, string> }
    }>(`${base}/prepare`, {
      method: 'POST',
      body: JSON.stringify({
        checksum,
        size: file.size,
        contentType: messageMediaType(file),
        fileName: file.name.slice(0, 255) || 'attachment',
      }),
    })
    let attachment = prepared.media
    if (prepared.upload) {
      progress(`Uploading ${index + 1} of ${files.length}…`)
      const response = await fetch(prepared.upload.url, {
        method: 'PUT',
        headers: prepared.upload.headers,
        body: file,
        credentials: 'omit',
      })
      // An immutable object can already exist after an interrupted attempt.
      if (!response.ok && response.status !== 412)
        throw new Error(
          `Could not upload ${file.name}. Your selection is saved; please try again.`,
        )
      attachment = (
        await apiJson<{ media: ChatAttachment }>(
          `${base}/${attachment.id}/complete`,
          { method: 'POST' },
        )
      ).media
    }
    media.push(attachment)
  }
  return media
}

export function messageMediaUrl(threadId: string, mediaId: string) {
  return apiUrl(
    `/api/messaging/threads/${encodeURIComponent(threadId)}/media/${encodeURIComponent(mediaId)}/content`,
  )
}
export async function clearMessageMediaCaches() {
  if (typeof caches === 'undefined') return
  await Promise.all(
    (await caches.keys())
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => caches.delete(name)),
  )
}
async function cacheForUser(userId: string) {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(`${CACHE_PREFIX}${encodeURIComponent(userId)}`)
  } catch {
    return null
  }
}
async function saveCached(cache: Cache, key: string, blob: Blob) {
  // Cache storage can be denied or full. Viewing must still work without it.
  try {
    const entries = [...(await cache.keys())]
    let total = 0
    const sizes = await Promise.all(
      entries.map(async (entry) =>
        Number((await cache.match(entry))?.headers.get('Content-Length') ?? 0),
      ),
    )
    total = sizes.reduce((sum, size) => sum + size, 0)
    while (
      entries.length &&
      (total + blob.size > MAX_CACHE_BYTES || entries.length >= 40)
    ) {
      await cache.delete(entries.shift()!)
      total -= sizes.shift() ?? 0
    }
    await cache.put(
      key,
      new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'Content-Length': String(blob.size),
        },
      }),
    )
  } catch {
    /* Optional persistent cache. */
  }
}
export async function loadMessageMedia(
  userId: string,
  threadId: string,
  media: ChatAttachment,
  signal?: AbortSignal,
): Promise<Blob> {
  const path = `/api/messaging/threads/${encodeURIComponent(threadId)}/media/${encodeURIComponent(media.id)}`
  // Always reauthorize, even when the bytes are already on this device.
  const access = await apiJson<{ media: ChatAttachment }>(`${path}/access`, {
    signal,
  })
  if (access.media.checksum !== media.checksum)
    throw new Error('Media has changed. Refresh the conversation.')
  const cache = await cacheForUser(userId)
  const key = apiUrl(`/__message_media_cache/${media.checksum}`)
  const saved = await cache?.match(key).catch(() => undefined)
  if (saved && Number(saved.headers.get('Content-Length')) === media.size)
    return saved.blob()
  const downloadKey = `${userId}/${media.checksum}`
  let download = downloads.get(downloadKey)
  if (!download) {
    download = (async () => {
      // Share an in-flight download across duplicate attachments. Each caller has
      // already passed its own membership check before joining this promise.
      const response = await fetch(messageMediaUrl(threadId, media.id), {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Could not load this attachment.')
      const blob = await response.blob()
      if (blob.size !== media.size || (await sha256(blob)) !== media.checksum)
        throw new Error('Media checksum did not match. Please try again.')
      if (cache) {
        cacheWrites = cacheWrites
          .then(() => saveCached(cache, key, blob))
          .catch(() => {})
        await cacheWrites
      }
      return blob
    })().finally(() => downloads.delete(downloadKey))
    downloads.set(downloadKey, download)
  }
  const blob = await download
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return blob
}
