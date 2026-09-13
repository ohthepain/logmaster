import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import { isAdminRequest } from '../admin-auth'
import {
  findProduct,
  getProduct,
  ProductResearchBusy,
} from '../product-catalog'
import { storeProductResource } from '../product-media'
import { getPhotoObject } from '../s3-photos'
import { productIdentity } from '../../domain/product-catalog'
import {
  editAdminProduct,
  getAdminProduct,
  productAdminEditSchema,
  ProductAdminError,
  searchAdminProducts,
} from '../product-admin'

export const productsRoutes = new Hono()
productsRoutes.use('*', async (c, next) => {
  if (!(await getSessionUserId(c.req.raw.headers)))
    return c.json({ error: 'Unauthorized' }, 401)
  await next()
})
productsRoutes.get('/', async (c) => {
  const brand = c.req.query('brand')?.trim().slice(0, 100) ?? ''
  const model = c.req.query('model')?.trim().slice(0, 200) ?? ''
  if (!brand || !model) return c.json({ products: [] })
  const exact = await findProduct(brand, model)
  const { brandKey, modelKey } = productIdentity(brand, model)
  const candidates = exact
    ? [exact]
    : await prisma.catalogProduct.findMany({
        where: {
          brandKey,
          modelKey: { startsWith: modelKey },
          reviewStatus: { not: 'rejected' },
        },
        take: 8,
        orderBy: { modelNumber: 'asc' },
      })
  return c.json({
    products: await Promise.all(
      candidates.map((p) => getProduct(p.id, c.req.query('language'))),
    ),
    exact: !!exact,
  })
})
productsRoutes.get('/review', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const rows = await prisma.catalogProduct.findMany({
    where: c.req.query('all') === '1' ? {} : { reviewStatus: 'candidate' },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })
  return c.json({
    products: await Promise.all(
      rows.map((p) => getProduct(p.id, c.req.query('language'), true)),
    ),
  })
})
productsRoutes.get('/admin', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const parsed = z
    .object({
      q: z.string().trim().max(200).default(''),
      status: z
        .enum(['all', 'candidate', 'verified', 'rejected'])
        .default('all'),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    })
    .safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Invalid search.' }, 400)
  return c.json(
    await searchAdminProducts(
      parsed.data.q,
      parsed.data.status,
      parsed.data.page,
    ),
  )
})
productsRoutes.get('/admin/:productId', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const product = await getAdminProduct(c.req.param('productId'))
  return product
    ? c.json({ product })
    : c.json({ error: 'Product not found.' }, 404)
})
productsRoutes.patch('/admin/:productId', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const parsed = productAdminEditSchema.safeParse(
    await c.req.json().catch(() => null),
  )
  if (!parsed.success)
    return c.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid product data.' },
      400,
    )
  try {
    return c.json({
      product: await editAdminProduct(
        c.req.param('productId'),
        parsed.data,
        (await getSessionUserId(c.req.raw.headers))!,
      ),
    })
  } catch (error) {
    if (error instanceof ProductAdminError)
      return c.json({ error: error.message }, error.status)
    if ((error as { code?: string }).code === 'P2002')
      return c.json(
        {
          error:
            'This model, alias or source already exists. Check for duplicates.',
        },
        409,
      )
    return c.json(
      {
        error:
          'Could not save the shared asset information. Check the selected photo and retry.',
      },
      400,
    )
  }
})
productsRoutes.get('/:productId', async (c) => {
  const product = await getProduct(
    c.req.param('productId'),
    c.req.query('language'),
  )
  return product
    ? c.json({ product })
    : c.json({ error: 'Product not found.' }, 404)
})
productsRoutes.get('/:productId/resources/:resourceId/content', async (c) => {
  try {
    const file = await storeProductResource(
      c.req.param('productId'),
      c.req.param('resourceId'),
    )
    const display = c.req.query('display') === '1' && file.displayS3Key
    const object = await getPhotoObject(display || file.originalS3Key!)
    if (!object.Body) return c.json({ error: 'Resource unavailable.' }, 404)
    return new Response(Buffer.from(await object.Body.transformToByteArray()), {
      headers: {
        'Content-Type': display
          ? 'image/webp'
          : (file.mimeType ?? 'application/octet-stream'),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof ProductResearchBusy
            ? 'This file is being prepared. Please retry shortly.'
            : 'This product source could not be downloaded.',
      },
      error instanceof ProductResearchBusy ? 409 : 400,
    )
  }
})
const reviewSchema = z.object({
  status: z.enum(['candidate', 'verified', 'rejected']).optional(),
  imageId: z.string().min(1).nullable().optional(),
  resourceId: z.string().min(1).optional(),
  resourceStatus: z.enum(['verified', 'rejected']).optional(),
  alias: z.string().trim().min(1).max(200).optional(),
  // Only an admin can replace sourced information. Edits retain provenance.
  language: z.string().max(35).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
})
productsRoutes.patch('/:productId/review', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid review.' }, 400)
  const input = parsed.data
  const product = await prisma.catalogProduct.findUnique({
    where: { id: c.req.param('productId') },
  })
  if (!product) return c.json({ error: 'Product not found.' }, 404)
  try {
    if (input.imageId) {
      const image = await storeProductResource(product.id, input.imageId)
      if (image.purpose !== 'photo' || !image.displayS3Key)
        throw new Error('Choose a product photo.')
    }
    await prisma.$transaction(async (tx) => {
      if (input.resourceId && input.resourceStatus) {
        const updated = await tx.productResource.updateMany({
          where: { id: input.resourceId, productId: product.id },
          data: { reviewStatus: input.resourceStatus },
        })
        if (!updated.count) throw new Error('Resource not found.')
        if (
          input.resourceStatus === 'rejected' &&
          product.canonicalImageId === input.resourceId
        ) {
          await tx.catalogProduct.update({
            where: { id: product.id },
            data: { canonicalImageId: null },
          })
        }
      }
      if (input.alias) {
        const key = productIdentity(product.brand, input.alias)
        const exact = await tx.catalogProduct.findUnique({
          where: {
            brandKey_modelKey: {
              brandKey: key.brandKey,
              modelKey: key.modelKey,
            },
          },
        })
        if (exact && exact.id !== product.id)
          throw new Error('That model already belongs to a different product.')
        await tx.productAlias.create({
          data: {
            productId: product.id,
            brandKey: key.brandKey,
            modelKey: key.modelKey,
            label: input.alias,
          },
        })
      }
      if (input.name !== undefined || input.description !== undefined) {
        const locale = await tx.productLocale.findUniqueOrThrow({
          where: {
            productId_language: {
              productId: product.id,
              language: input.language ?? 'en',
            },
          },
        })
        if (
          !locale.result ||
          typeof locale.result !== 'object' ||
          Array.isArray(locale.result)
        )
          throw new Error('Research this language before editing.')
        await tx.productLocale.update({
          where: { id: locale.id },
          data: {
            result: {
              ...locale.result,
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.description !== undefined
                ? { description: input.description }
                : {}),
            },
          },
        })
      }
      if (input.imageId)
        await tx.productResource.update({
          where: { id: input.imageId },
          data: { reviewStatus: 'verified' },
        })
      await tx.catalogProduct.update({
        where: { id: product.id },
        data: {
          ...(input.status
            ? {
                reviewStatus: input.status,
                reviewedAt: new Date(),
                reviewedBy: await getSessionUserId(c.req.raw.headers),
              }
            : {}),
          ...(input.imageId !== undefined
            ? { canonicalImageId: input.imageId }
            : {}),
        },
      })
    })
    return c.json({
      product: await getProduct(product.id, input.language, true),
    })
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error && !error.message.includes('prisma')
            ? error.message
            : 'Could not save the review; check for an existing alias.',
      },
      400,
    )
  }
})
