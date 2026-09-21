import type { LogEntry, Media } from '../domain/logbook'
import { apiUrl } from './app-origin'
import { uploadMessageFiles } from './messaging/media'

export async function durableMediaUrl(url: string | null | undefined) {
  if (!url?.startsWith('blob:')) return url ?? null
  const response = await fetch(url)
  if (!response.ok)
    throw new Error('Could not save the recording. Please try again.')
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not save media offline'))
    reader.readAsDataURL(blob)
  })
}
export function localLogMediaSource(media: Media) {
  if (media.chatMediaId) return null
  return (
    [media.remoteUrl, media.thumbnailUrl].find(
      (value) =>
        value?.startsWith('blob:') ||
        /^data:(image|video|audio)\//.test(value ?? ''),
    ) ?? null
  )
}
export async function uploadLogMediaForSync(
  media: Media[],
  entries: LogEntry[],
) {
  const output: Media[] = []
  for (const item of media) {
    const source = localLogMediaSource(item)
    const entry = entries.find((candidate) => candidate.id === item.logEntryId)
    if (!source || !entry || entry.deleted) {
      output.push(item)
      continue
    }
    const response = await fetch(source)
    if (!response.ok)
      throw new Error('Saved log media is unavailable on this device.')
    const blob = await response.blob()
    const file = new File(
      [blob],
      item.localPath ??
        (item.type === 'voice' ? 'voice-note.webm' : 'photo.jpg'),
      { type: blob.type },
    )
    const [uploaded] = await uploadMessageFiles(
      `trip:${entry.tripId}`,
      [file],
      () => {},
      entry.tripId,
    )
    const url = `/api/logbook/trips/${encodeURIComponent(entry.tripId)}/media/${uploaded.id}/content`
    output.push({
      ...item,
      chatMediaId: uploaded.id,
      remoteUrl: url,
      thumbnailUrl: uploaded.contentType.startsWith('image/') ? url : null,
    })
  }
  return output
}
export function logMediaUrl(url: string) {
  return url.startsWith('/') ? apiUrl(url) : url
}
