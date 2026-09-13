import { getAssetIdentity } from '../domain/asset-brands'
import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { prisma } from './db'
import {
  boatDocumentS3Key,
  deletePhotoObject,
  uploadPhotoObject,
} from './s3-photos'
import type { createAssetSchema } from './asset-intelligence-schema'
import { prepareOriginalAssetPhoto } from './asset-original-photo'
import { resolveProduct } from './product-catalog'
import { downloadAssetDocument } from './asset-download'

export async function createAssetWithAttachments(
  boatId: string,
  userId: string,
  input: z.infer<typeof createAssetSchema>,
  file?: File,
) {
  const identity = getAssetIdentity(input)
  const product =
    input.sharedProduct !== false && identity.brand && identity.modelNumber
      ? await resolveProduct(
          identity.brand,
          identity.modelNumber,
          input.productId,
        )
      : null
  if (input.productId && !product)
    throw new Error('Check the brand and model before selecting a product.')
  const id = randomUUID()
  const documentId = randomUUID()
  const versionId = randomUUID()
  const photo = file ? await prepareOriginalAssetPhoto(file) : null
  const key = boatDocumentS3Key(
    userId,
    boatId,
    documentId,
    versionId,
    photo?.extension ?? 'jpg',
  )
  const previewKey = `${key}.preview.jpg`
  try {
    if (photo) {
      await uploadPhotoObject(key, photo.original, photo.mimeType)
      await uploadPhotoObject(previewKey, photo.preview, 'image/jpeg')
    }
    await prisma.$transaction(async (tx) => {
      const connections = [
        ...new Map(
          input.confirmedConnections.map((item) => [item.assetId, item]),
        ).values(),
      ]
      const count = await tx.boatAsset.count({
        where: { boatId, id: { in: connections.map((item) => item.assetId) } },
      })
      if (count !== connections.length)
        throw new Error(
          'A connected asset no longer exists on this boat. Review the connections and try again.',
        )
      const max = await tx.boatAsset.aggregate({
        where: { boatId },
        _max: { sortOrder: true },
      })
      await tx.boatAsset.create({
        data: {
          id,
          boatId,
          productId: product?.id ?? null,
          name: identity.productName || identity.modelNumber || input.name,
          description: input.description || null,
          brand: identity.brand,
          modelNumber: identity.modelNumber,
          category: input.category ?? null,
          ownership: input.ownership,
          ownedByUserId:
            input.ownership === 'USER' ? input.ownedByUserId : null,
          onLoanFromUserId:
            input.ownership === 'USER' ? input.ownedByUserId : null,
          installedAt: input.installedAt ? new Date(input.installedAt) : null,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
          suggestedDownloads: {
            create: [
              ...new Map(
                (product ? [] : input.suggestedDownloads).map((item) => [
                  item.url,
                  item,
                ]),
              ).values(),
            ],
          },
        },
      })
      for (const connection of connections) {
        const [fromAssetId, toAssetId] = [id, connection.assetId].sort()
        await tx.assetConnection.create({
          data: {
            fromAssetId,
            toAssetId,
            reason: connection.reason,
            confirmedBy: userId,
          },
        })
      }
      if (photo) {
        const category = await tx.boatDocumentCategory.upsert({
          where: { boatId_name: { boatId, name: 'Photos' } },
          create: { boatId, name: 'Photos' },
          update: {},
        })
        await tx.boatDocument.create({
          data: {
            id: documentId,
            boatId,
            categoryId: category.id,
            title: `${input.name} photo`,
            purpose: 'photo',
            assetLinks: { create: { assetId: id } },
            versions: {
              create: {
                id: versionId,
                versionNumber: 1,
                kind: 'upload',
                s3Key: key,
                previewS3Key: previewKey,
                mimeType: photo.mimeType,
                fileName: file?.name || `asset-photo.${photo.extension}`,
              },
            },
          },
        })
      }
    })
    return id
  } catch (error) {
    if (photo)
      await Promise.all(
        [key, previewKey].map((storedKey) =>
          deletePhotoObject(storedKey).catch(() => {}),
        ),
      )
    throw error
  }
}

export async function attachSuggestedDownload(
  boatId: string,
  assetId: string,
  suggestionId: string,
  userId: string,
) {
  const suggestion = await prisma.assetSuggestedDownload.findFirst({
    where: { id: suggestionId, assetId, asset: { boatId } },
  })
  if (!suggestion) throw new Error('Suggestion not found.')
  if (suggestion.documentId) return suggestion.documentId
  const file = await downloadAssetDocument(suggestion.url)
  const documentId = randomUUID()
  const versionId = randomUUID()
  const key = boatDocumentS3Key(
    userId,
    boatId,
    documentId,
    versionId,
    file.extension,
  )
  await uploadPhotoObject(key, file.buffer, file.mimeType)
  try {
    const attachedId = await prisma.$transaction(async (tx) => {
      // Serialize concurrent taps/retries so a suggestion attaches only once.
      await tx.$queryRaw`SELECT "id" FROM "asset_suggested_download" WHERE "id" = ${suggestionId} FOR UPDATE`
      const current = await tx.assetSuggestedDownload.findUnique({
        where: { id: suggestionId },
      })
      if (!current) throw new Error('Suggestion was dismissed.')
      if (current.documentId) return current.documentId
      const purpose = file.mimeType.startsWith('image/')
        ? 'photo'
        : suggestion.purpose === 'photo'
          ? 'other'
          : suggestion.purpose
      const categoryName =
        purpose === 'photo'
          ? 'Photos'
          : purpose === 'manual'
            ? 'Instructions'
            : purpose === 'warranty'
              ? 'Warranties'
              : 'Miscellaneous'
      const category = await tx.boatDocumentCategory.upsert({
        where: { boatId_name: { boatId, name: categoryName } },
        create: { boatId, name: categoryName },
        update: {},
      })
      await tx.boatDocument.create({
        data: {
          id: documentId,
          boatId,
          categoryId: category.id,
          title: suggestion.title,
          purpose,
          assetLinks: { create: { assetId } },
          versions: {
            create: {
              id: versionId,
              versionNumber: 1,
              kind: 'upload',
              s3Key: key,
              mimeType: file.mimeType,
              fileName: `${suggestion.title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 100) || 'document'}.${file.extension}`,
            },
          },
        },
      })
      await tx.assetSuggestedDownload.update({
        where: { id: suggestionId },
        data: { documentId },
      })
      return documentId
    })
    if (attachedId !== documentId) await deletePhotoObject(key).catch(() => {})
    return attachedId
  } catch (error) {
    await deletePhotoObject(key).catch(() => {})
    throw error
  }
}
