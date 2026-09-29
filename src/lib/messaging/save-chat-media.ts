import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { downloadBytes } from '../export-file'
import {
  saveToPhotoLibrary,
  supportsRecentPhotoPickerSheet,
} from '../native/logmaster-recent-photos'
import { getNativePlatform } from '../platform'

export type ChatMediaSaveResult =
  | 'saved'
  | 'shared'
  | 'downloaded'
  | 'cancelled'

export function isSavableChatMedia(contentType: string) {
  return contentType.startsWith('image/') || contentType.startsWith('video/')
}

export function hasSavableChatMedia(
  media: { contentType: string }[] | undefined,
) {
  return Boolean(media?.some((item) => isSavableChatMedia(item.contentType)))
}

export function chatMediaDownloadName(fileName: string, contentType: string) {
  const base = fileName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim()
    .slice(0, 120)
  const fallback = contentType.startsWith('video/') ? 'video' : 'photo'
  const safe = base || fallback
  if (/\.[a-z0-9]{1,8}$/i.test(safe)) return safe
  const subtype = contentType.split('/')[1]?.split('+')[0] ?? 'bin'
  const extension =
    subtype === 'quicktime' ? 'mov' : subtype === 'jpeg' ? 'jpg' : subtype
  return `${safe}.${extension}`
}

/** iOS saves straight into Photos. Android and phones use the share sheet, which can save to the camera roll. */
export function chatMediaSavePlan(input: {
  nativePlatform: 'ios' | 'android' | 'web'
  canShareFiles: boolean
  coarsePointer: boolean
}): 'photo-library' | 'share-sheet' | 'download' {
  if (input.nativePlatform === 'ios') return 'photo-library'
  if (
    input.nativePlatform === 'android' ||
    (input.coarsePointer && input.canShareFiles)
  ) {
    return 'share-sheet'
  }
  return 'download'
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message)
    if (message) return message
  }
  return 'Could not save this file.'
}

function isCancelled(error: unknown) {
  const message = errorText(error)
  return /cancel/i.test(message) || errorText(error) === 'AbortError'
}

function isUnimplemented(error: unknown) {
  return /not implemented|unimplemented/i.test(errorText(error))
}

async function blobBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read this file.'))
    reader.readAsDataURL(blob)
  })
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1)
  if (!encoded) throw new Error('Could not read this file.')
  return encoded
}

async function writeCacheFile(fileName: string, blob: Blob) {
  const path = `chat-media/${Date.now()}-${fileName}`
  await Filesystem.writeFile({
    path,
    data: await blobBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  })
  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  })
  return { path, uri }
}

async function deleteCacheFile(path: string) {
  await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(
    () => {},
  )
}

async function shareFile(uri: string, fileName: string, contentType: string) {
  try {
    await Share.share({
      title: fileName,
      dialogTitle: contentType.startsWith('video/')
        ? 'Save video'
        : 'Save photo',
      files: [uri],
    })
    return 'shared' as const
  } catch (error) {
    if (isCancelled(error)) return 'cancelled' as const
    throw new Error(errorText(error))
  }
}

export async function saveChatMedia(
  blob: Blob,
  fileName: string,
  contentType: string,
): Promise<ChatMediaSaveResult> {
  if (!isSavableChatMedia(contentType)) {
    throw new Error('Only photos and videos can be saved.')
  }
  if (blob.size <= 0) throw new Error('Could not save an empty file.')
  const downloadName = chatMediaDownloadName(fileName, contentType)
  const platform = getNativePlatform()
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    Boolean(
      navigator.canShare?.({
        files: [new File([blob], downloadName, { type: contentType })],
      }),
    )
  const coarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
  const plan = chatMediaSavePlan({
    nativePlatform: platform,
    canShareFiles,
    coarsePointer,
  })

  if (plan === 'download') {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    downloadBytes(downloadName, bytes, contentType)
    return 'downloaded'
  }

  const cached = await writeCacheFile(downloadName, blob)
  try {
    if (
      plan === 'photo-library' &&
      supportsRecentPhotoPickerSheet() &&
      Capacitor.isPluginAvailable('LogmasterRecentPhotos')
    ) {
      try {
        await saveToPhotoLibrary({
          path: cached.uri,
          contentType,
        })
        return 'saved'
      } catch (error) {
        if (!isUnimplemented(error)) throw new Error(errorText(error))
      }
    }
    return await shareFile(cached.uri, downloadName, contentType)
  } finally {
    await deleteCacheFile(cached.path)
  }
}
