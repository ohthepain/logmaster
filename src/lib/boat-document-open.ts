import type { BoatDocument, BoatDocumentVersion } from '../domain/boat'
import {
  cacheFileNameForBoatDocument,
  getBoatDocumentViewKind,
  isBoatDocumentViewable
  
} from './boat-document-viewer'
import type {BoatDocumentViewKind} from './boat-document-viewer';
import { apiUrl } from './app-origin'
import { isNativePlatform } from './platform'

export type BoatDocumentOpenTarget = {
  title: string
  kind: BoatDocument['currentVersion']['kind']
  mimeType: string | null
  fileName: string | null
  url: string | null
  contentUrl: string | null
}

export type BoatDocumentViewerPayload = {
  title: string
  contentUrl: string
  viewKind: BoatDocumentViewKind
}

export function boatDocumentOpenTarget(
  document: BoatDocument,
): BoatDocumentOpenTarget {
  const version = document.currentVersion
  return {
    title: document.title,
    kind: version.kind,
    mimeType: version.mimeType,
    fileName: version.fileName,
    url: version.url,
    contentUrl: version.contentUrl,
  }
}

export function boatDocumentVersionOpenTarget(
  title: string,
  version: BoatDocumentVersion,
): BoatDocumentOpenTarget {
  return {
    title,
    kind: version.kind,
    mimeType: version.mimeType,
    fileName: version.fileName,
    url: version.url,
    contentUrl: version.contentUrl,
  }
}

export { getBoatDocumentViewKind, isBoatDocumentViewable }

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchBoatDocumentBytes(
  target: BoatDocumentOpenTarget,
): Promise<ArrayBuffer> {
  if (!target.contentUrl) {
    throw new Error('Document is unavailable')
  }

  const response = await fetch(apiUrl(target.contentUrl), {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to load document')
  }

  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error('Document is empty')
  }

  return bytes
}

async function openNativeBoatDocumentViewer(
  target: BoatDocumentOpenTarget,
): Promise<void> {
  const bytes = await fetchBoatDocumentBytes(target)
  const [{ Filesystem, Directory }, { FileViewer }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/file-viewer'),
  ])

  const cacheName = cacheFileNameForBoatDocument(target)
  await Filesystem.writeFile({
    path: cacheName,
    directory: Directory.Cache,
    data: arrayBufferToBase64(bytes),
  })

  const { uri } = await Filesystem.getUri({
    path: cacheName,
    directory: Directory.Cache,
  })

  await FileViewer.openDocumentFromLocalPath({ path: uri })
}

export async function openBoatDocumentExternal(
  target: BoatDocumentOpenTarget,
): Promise<void> {
  if (target.kind === 'link' && target.url) {
    window.open(target.url, '_blank', 'noopener,noreferrer')
    return
  }
  if (target.contentUrl) {
    window.open(apiUrl(target.contentUrl), '_blank', 'noopener,noreferrer')
    return
  }
  throw new Error('Document is unavailable')
}

type OpenBoatDocumentOptions = {
  onOpenViewer?: (payload: BoatDocumentViewerPayload) => void
}

export async function openBoatDocument(
  target: BoatDocumentOpenTarget,
  options: OpenBoatDocumentOptions = {},
): Promise<void> {
  const viewKind = getBoatDocumentViewKind(target)
  if (viewKind && target.contentUrl) {
    if (isNativePlatform()) {
      await openNativeBoatDocumentViewer(target)
      return
    }
    if (options.onOpenViewer) {
      options.onOpenViewer({
        title: target.title,
        contentUrl: apiUrl(target.contentUrl),
        viewKind,
      })
      return
    }
  }

  await openBoatDocumentExternal(target)
}

export async function openBoatDocumentRecord(
  document: BoatDocument,
  options: OpenBoatDocumentOptions = {},
): Promise<void> {
  return openBoatDocument(boatDocumentOpenTarget(document), options)
}
