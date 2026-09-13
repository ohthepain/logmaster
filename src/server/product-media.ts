import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { prisma } from './db'
import { downloadAssetDocument } from './asset-download'
import { deletePhotoObject, uploadPhotoObject } from './s3-photos'
import { ProductResearchBusy } from './product-catalog'

// Only existing, researched public resources can enter this storage path.
// No user upload/boat document key is ever accepted as a product image.
export async function storeProductResource(
  productId: string,
  resourceId: string,
) {
  const resource = await prisma.productResource.findFirst({
    where: {
      id: resourceId,
      productId,
      reviewStatus: { not: 'rejected' },
      product: { reviewStatus: { not: 'rejected' } },
    },
  })
  if (!resource) throw new Error('Product resource not found.')
  if (resource.originalS3Key) return resource
  const token = randomUUID()
  const claim = await prisma.productResource.updateMany({
    where: {
      id: resourceId,
      originalS3Key: null,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: { leaseToken: token, leaseUntil: new Date(Date.now() + 180_000) },
  })
  if (!claim.count) throw new ProductResearchBusy()
  const staged: string[] = []
  try {
    const file = await downloadAssetDocument(resource.sourceUrl)
    if (resource.purpose !== 'photo' && file.mimeType !== 'application/pdf')
      throw new Error('The document source did not return a PDF.')
    const originalS3Key = `products/${productId}/${resource.id}/${token}/original.${file.extension}`
    let displayS3Key: string | null = null
    // Create a consistently sized display copy; preserve the original and all
    // markings. No generative retouching or inferred reconstruction of labels.
    if (file.mimeType.startsWith('image/')) {
      const display = await sharp(file.buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toBuffer()
      displayS3Key = `products/${productId}/${resource.id}/${token}/display.webp`
      staged.push(displayS3Key)
      await uploadPhotoObject(displayS3Key, display, 'image/webp')
    } else if (resource.purpose === 'photo')
      throw new Error('The image source did not return a photo.')
    staged.push(originalS3Key)
    await uploadPhotoObject(originalS3Key, file.buffer, file.mimeType)
    const saved = await prisma.productResource.updateMany({
      where: {
        id: resource.id,
        leaseToken: token,
        reviewStatus: { not: 'rejected' },
      },
      data: {
        originalS3Key,
        displayS3Key,
        mimeType: file.mimeType,
        leaseToken: null,
        leaseUntil: null,
      },
    })
    if (!saved.count) throw new Error('The resource changed during download.')
    return { ...resource, originalS3Key, displayS3Key, mimeType: file.mimeType }
  } catch (error) {
    await Promise.all(
      staged.map((key) => deletePhotoObject(key).catch(() => {})),
    )
    await prisma.productResource.updateMany({
      where: { id: resource.id, leaseToken: token },
      data: { leaseToken: null, leaseUntil: null },
    })
    throw error
  }
}
