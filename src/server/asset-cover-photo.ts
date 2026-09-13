export type AssetCoverPhotoPayload = {
  documentId: string
  contentUrl: string
} | null

type LinkedDocument = {
  id: string
  purpose: string | null
  createdAt: Date
  versions: Array<{
    id: string
    kind: string
    mimeType: string | null
    fileName: string | null
    versionNumber: number
    previewS3Key?: string | null
  }>
}

function latestVersion(document: LinkedDocument) {
  return document.versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber)[0]
}

function isUploadImageVersion(
  version: NonNullable<ReturnType<typeof latestVersion>>,
): boolean {
  if (version.kind !== 'upload') return false
  const mime = version.mimeType?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return true
  if (mime && mime !== 'application/octet-stream') return false
  const name = version.fileName?.toLowerCase() ?? ''
  return /\.(jpe?g|png|gif|webp|heic|heif)$/.test(name)
}

/** Default cover: earliest linked photo document, else earliest linked image upload. */
export function pickAssetCoverPhoto(
  documentLinks: Array<{ document: LinkedDocument }>,
): AssetCoverPhotoPayload {
  const candidates = documentLinks
    .map(({ document }) => {
      const version = latestVersion(document)
      if (!version || !isUploadImageVersion(version)) return null
      return {
        document,
        version,
        isPurposePhoto: document.purpose === 'photo',
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.isPurposePhoto !== b.isPurposePhoto) {
        return a.isPurposePhoto ? -1 : 1
      }
      return a.document.createdAt.getTime() - b.document.createdAt.getTime()
    })

  const pick = candidates[0]
  if (!pick) return null

  return {
    documentId: pick.document.id,
    contentUrl: `/api/boats/documents/versions/${pick.version.id}/content${pick.version.previewS3Key ? '?preview=1' : ''}`,
  }
}
