import type { OrgDocument, OrgDocumentVersion } from '../domain/org'
import type { BoatDocumentViewKind } from './boat-document-viewer'
import {
  cacheFileNameForBoatDocument,
  getBoatDocumentViewKind,
  isBoatDocumentViewable,
} from './boat-document-viewer'
import { apiUrl } from './app-origin'
import { isNativePlatform } from './platform'

export type OrgDocumentOpenTarget = {
  title: string
  kind: OrgDocument['currentVersion']['kind']
  mimeType: string | null
  fileName: string | null
  url: string | null
  contentUrl: string | null
}

export type OrgDocumentViewerPayload = {
  title: string
  contentUrl: string
  viewKind: BoatDocumentViewKind
}

export function orgDocumentOpenTarget(
  document: OrgDocument,
): OrgDocumentOpenTarget {
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

export function orgDocumentVersionOpenTarget(
  title: string,
  version: OrgDocumentVersion,
): OrgDocumentOpenTarget {
  return {
    title,
    kind: version.kind,
    mimeType: version.mimeType,
    fileName: version.fileName,
    url: version.url,
    contentUrl: version.contentUrl,
  }
}

export {
  getBoatDocumentViewKind as getOrgDocumentViewKind,
  isBoatDocumentViewable as isOrgDocumentViewable,
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchOrgDocumentBytes(
  target: OrgDocumentOpenTarget,
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

async function openNativeOrgDocumentViewer(
  target: OrgDocumentOpenTarget,
): Promise<void> {
  const bytes = await fetchOrgDocumentBytes(target)
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

export async function openOrgDocumentExternal(
  target: OrgDocumentOpenTarget,
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

type OpenOrgDocumentOptions = {
  onOpenViewer?: (payload: OrgDocumentViewerPayload) => void
}

export async function openOrgDocument(
  target: OrgDocumentOpenTarget,
  options: OpenOrgDocumentOptions = {},
): Promise<void> {
  const viewKind = getBoatDocumentViewKind(target)
  if (viewKind && target.contentUrl) {
    if (isNativePlatform()) {
      await openNativeOrgDocumentViewer(target)
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

  await openOrgDocumentExternal(target)
}

export async function openOrgDocumentRecord(
  document: OrgDocument,
  options: OpenOrgDocumentOptions = {},
): Promise<void> {
  return openOrgDocument(orgDocumentOpenTarget(document), options)
}
