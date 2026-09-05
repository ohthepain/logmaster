import { Share } from '@capacitor/share'
import { isNativePlatform } from './platform'

export type SaveOrShareFileOptions = {
  /** Skip Web Share and use save picker / download (better for exporting files to disk). */
  preferSave?: boolean
  /** Use anchor download instead of showSaveFilePicker (needed for stamped photos in embedded browsers). */
  preferDownload?: boolean
}

function assertNonEmptyFile(file: File): void {
  if (file.size <= 0) {
    throw new Error(`Cannot save empty file (${file.name})`)
  }
}

function assertNonEmptyBytes(bytes: Uint8Array, fileName: string): void {
  if (bytes.byteLength <= 0) {
    throw new Error(`Cannot save empty file (${fileName})`)
  }
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  assertNonEmptyBytes(bytes, file.name)
  return bytes
}

function bytesToBlob(bytes: Uint8Array, mimeType: string): Blob {
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

function downloadBlob(fileName: string, blob: Blob): boolean {
  if (blob.size <= 0) {
    throw new Error(`Cannot download empty file (${fileName})`)
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
  )
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
  return true
}

/** Save bytes via browser download (reliable in embedded/Electron browsers). */
export function downloadBytes(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  assertNonEmptyBytes(bytes, fileName)
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' })
  if (blob.size <= 0) {
    throw new Error(`Cannot download empty file (${fileName})`)
  }
  return downloadBlob(fileName, blob)
}

async function pickPhotoSaveHandle(
  fileName: string,
): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) return null

  return (
    window as Window & {
      showSaveFilePicker: (options: {
        suggestedName: string
        types: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<FileSystemFileHandle>
    }
  ).showSaveFilePicker({
    suggestedName: fileName,
    types: [
      {
        description: 'JPEG',
        accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
      },
    ],
  })
}

async function writeBytesToHandle(
  handle: FileSystemFileHandle,
  bytes: Uint8Array,
  fileName: string,
): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(bytes)
    await writable.close()
    const saved = await handle.getFile()
    if (saved.size <= 0) {
      throw new Error(`Save failed: ${fileName} is empty`)
    }
  } catch (error) {
    try {
      await writable.abort()
    } catch {
      // ignore abort failures
    }
    throw error
  }
}

/** Save stamped JPEG bytes — picker first (while click is active), then write. */
export async function saveStampedPhotoBytes(
  saveFileName: string,
  bytes: Uint8Array,
): Promise<boolean> {
  assertNonEmptyBytes(bytes, saveFileName)

  let handle: FileSystemFileHandle | null = null
  try {
    handle = await pickPhotoSaveHandle(saveFileName)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false
    throw error
  }

  if (handle) {
    await writeBytesToHandle(handle, bytes, saveFileName)
    return true
  }

  return downloadBytes(saveFileName, bytes, 'image/jpeg')
}

export async function pickStampedPhotoSaveLocation(
  saveFileName: string,
): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) return null
  try {
    return await pickPhotoSaveHandle(saveFileName)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    return null
  }
}

export async function writeStampedPhotoToHandle(
  handle: FileSystemFileHandle,
  bytes: Uint8Array,
  saveFileName: string,
): Promise<void> {
  await writeBytesToHandle(handle, bytes, saveFileName)
}

async function saveBlobWithPicker(fileName: string, blob: Blob): Promise<boolean> {
  if (blob.size <= 0) {
    throw new Error(`Cannot save empty file (${fileName})`)
  }

  const extension = fileName.split('.').pop()?.toLowerCase() ?? 'bin'
  const mimeType = blob.type || 'application/octet-stream'
  const accept =
    mimeType === 'image/jpeg'
      ? { 'image/jpeg': ['.jpg', '.jpeg'] }
      : { [mimeType]: [`.${extension}`] }

  const handle = await (
    window as Window & {
      showSaveFilePicker: (options: {
        suggestedName: string
        types: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<FileSystemFileHandle>
    }
  ).showSaveFilePicker({
    suggestedName: fileName,
    types: [
      {
        description: extension.toUpperCase(),
        accept,
      },
    ],
  })

  const bytes = new Uint8Array(await blob.arrayBuffer())
  await writeBytesToHandle(handle, bytes, fileName)
  return true
}

export async function saveOrShareFile(
  file: File,
  options: SaveOrShareFileOptions = {},
): Promise<boolean> {
  assertNonEmptyFile(file)
  // Read bytes before any modal dialog — the underlying blob can be released while waiting.
  const bytes = await fileToBytes(file)
  const blob = bytesToBlob(bytes, file.type)

  if (
    !options.preferSave &&
    typeof navigator !== 'undefined' &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return true
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false
    }
  }

  if (isNativePlatform()) {
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
      reader.readAsDataURL(file)
    })
    await Share.share({
      title: file.name,
      dialogTitle: 'Share trip export',
      url: dataUrl,
    })
    return true
  }

  if (options.preferDownload) {
    return downloadBlob(file.name, blob)
  }

  if ('showSaveFilePicker' in window) {
    try {
      return await saveBlobWithPicker(file.name, blob)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false
      throw error
    }
  }

  return downloadBlob(file.name, blob)
}

export function sanitizeExportFileName(name: string, extension: string): string {
  const base =
    name
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'trip'
  return `${base}.${extension.replace(/^\./, '')}`
}
