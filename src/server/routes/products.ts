import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import { isAdminRequest } from '../admin-auth'
import {
  findProduct,
  searchCatalogProducts,
  resolveProduct,
  ensureProductResearch,
  ensureProductPhotoResearch,
  ensureProductPhotoFromDirectUrl,
  ensureProductPhotoFromSourcePage,
  catalogProductHasPhoto,
  getProduct,
  ProductResearchBusy,
  ensureProductPhotoFromManufacturerPage,
} from '../product-catalog'
import { httpsPublicUrl } from '../asset-intelligence-schema'
import { storeProductResource } from '../product-media'
import { getPhotoObject } from '../s3-photos'
import { productIdentity, productModelKey } from '../../domain/product-catalog'
import { suggestEquipmentModelOptions } from '../product-model-suggest'
import { ASSET_BRANDS, findAssetBrand } from '../../domain/asset-brands'
import {
  editAdminProduct,
  getAdminProduct,
  productAdminEditSchema,
  ProductAdminError,
  regenerateAdminProductResearch,
  searchAdminProducts,
} from '../product-admin'

export const productsRoutes = new Hono()
productsRoutes.use('*', async (c, next) => {
  if (!(await getSessionUserId(c.req.raw.headers)))
    return c.json({ error: 'Unauthorized' }, 401)
  await next()
})
productsRoutes.get('/brands', async (c) => {
  const query = c.req.query('q')?.trim().slice(0, 100) ?? ''
  const rows = await prisma.catalogProduct.findMany({
    where: {
      reviewStatus: { not: 'rejected' },
      brand: { contains: query, mode: 'insensitive' },
    },
    distinct: ['brand'],
    select: { brand: true },
    orderBy: { brand: 'asc' },
    take: 30,
  })
  const names = new Set([
    ...ASSET_BRANDS.filter((brand) =>
      [brand.name, ...brand.aliases].some((name) =>
        name.toLowerCase().includes(query.toLowerCase()),
      ),
    ).map((brand) => brand.name),
    ...rows.map((row) => findAssetBrand(row.brand)?.name ?? row.brand),
  ])
  return c.json({
    brands: [...names]
      .sort()
      .slice(0, 30)
      .map((name) => ({ name, logo: findAssetBrand(name)?.logo ?? null })),
  })
})
productsRoutes.post('/resolve', async (c) => {
  const input = z
    .object({
      brand: z.string().trim().min(1).max(100),
      model: z.string().trim().min(1).max(200),
      language: z.string().max(35).default('en'),
      productId: z.string().trim().min(1).max(200).optional(),
      sourceUrl: httpsPublicUrl.optional(),
      photoUrl: httpsPublicUrl.nullable().optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!input.success) return c.json({ error: 'Enter a brand and model.' }, 400)
  try {
    const row = await resolveProduct(
      input.data.brand,
      input.data.model,
      input.data.productId,
    )
    let product = await getProduct(row.id, input.data.language)
    let pending = false
    let notice = ''
    if (input.data.photoUrl || input.data.sourceUrl) {
      try {
        if (input.data.photoUrl) {
          await ensureProductPhotoFromDirectUrl(row.id, input.data.photoUrl, {
            sourcePageUrl: input.data.sourceUrl,
          })
        }
        product = await getProduct(row.id, input.data.language)
        if (!catalogProductHasPhoto(product) && input.data.sourceUrl) {
          await ensureProductPhotoFromManufacturerPage(
            row.id,
            input.data.sourceUrl,
          )
        }
        product = await getProduct(row.id, input.data.language)
        if (!catalogProductHasPhoto(product) && input.data.sourceUrl) {
          await ensureProductPhotoFromSourcePage(row.id, input.data.sourceUrl)
        }
        product = await getProduct(row.id, input.data.language)
      } catch (error) {
        if (!(error instanceof ProductResearchBusy)) {
          console.warn(
            JSON.stringify({
              action: 'product.resolve.link_photo',
              productId: row.id,
              outcome: 'error',
              errorCode: error instanceof Error ? error.name : 'unknown',
            }),
          )
        }
      }
    }
    const needsInfo = !product?.info
    const needsPhoto = !catalogProductHasPhoto(product)

    if (needsInfo) {
      try {
        await ensureProductResearch(row.id, 'en', true)
      } catch (error) {
        pending = error instanceof ProductResearchBusy
        if (!pending)
          notice =
            'We could not find a product photo. Check the model or continue with your details.'
      }
    } else if (needsPhoto) {
      try {
        const found = await ensureProductPhotoResearch(row.id)
        if (!found)
          notice =
            'We searched online but could not verify a product photo for this model yet.'
      } catch (error) {
        pending = error instanceof ProductResearchBusy
        if (!pending)
          notice =
            'We could not search for a product photo right now. Check the model or continue with your details.'
      }
    }
    product = await getProduct(row.id, input.data.language)
    return c.json({ product, pending, notice })
  } catch {
    return c.json(
      {
        error:
          'This model could not be matched. Check the brand and model and retry.',
      },
      400,
    )
  }
})
productsRoutes.get('/', async (c) => {
  const brand = c.req.query('brand')?.trim().slice(0, 100) ?? ''
  const model = c.req.query('model')?.trim().slice(0, 200) ?? ''
  if (!brand) return c.json({ products: [], exact: false, ambiguous: false })
  const exact = model ? await findProduct(brand, model) : null
  const candidates = exact ? [exact] : await searchCatalogProducts(brand, model)
  const serialized = await Promise.all(
    candidates.map((p) => getProduct(p.id, c.req.query('language'))),
  )
  return c.json({
    products: serialized,
    exact: !!exact,
    ambiguous:
      !exact &&
      (serialized.length > 1 ||
        (serialized.length === 1 &&
          !!model &&
          productModelKey(serialized[0]!.modelNumber) !==
            productModelKey(model))),
  })
})
productsRoutes.post('/model-options', async (c) => {
  const parsed = z
    .object({
      brand: z.string().trim().min(1).max(100),
      query: z.string().trim().min(1).max(200),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter a brand and model.' }, 400)
  try {
    return c.json(
      await suggestEquipmentModelOptions(parsed.data.brand, parsed.data.query),
    )
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not suggest model numbers.',
      },
      503,
    )
  }
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
productsRoutes.post('/admin/:productId/research', async (c) => {
  if (!(await isAdminRequest(c.req.raw.headers)))
    return c.json({ error: 'Forbidden' }, 403)
  const parsed = z
    .object({
      language: z.string().trim().max(35).default('en'),
    })
    .safeParse((await c.req.json().catch(() => null)) ?? {})
  if (!parsed.success) return c.json({ error: 'Invalid language.' }, 400)
  try {
    return c.json({
      product: await regenerateAdminProductResearch(
        c.req.param('productId'),
        parsed.data.language,
      ),
    })
  } catch (error) {
    if (error instanceof ProductAdminError)
      return c.json({ error: error.message }, error.status)
    return c.json(
      {
        error:
          'Could not regenerate AI information. Check the model and retry.',
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
