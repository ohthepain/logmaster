import type * as ProductResearchModule from './product-research'
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ensureProductResearch,
  getProduct,
  ProductResearchBusy,
  resolveProduct,
} from './product-catalog'
import {
  editAdminProduct,
  getAdminProduct,
  productAdminEditSchema,
  searchAdminProducts,
} from './product-admin'

const state = vi.hoisted(() => ({
  client: null as unknown as PrismaClient,
  research: vi.fn(),
  preview: vi.fn(),
}))
vi.mock('./db', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_, name) => {
        const value = state.client[name as keyof PrismaClient]
        return typeof value === 'function' ? value.bind(state.client) : value
      },
    },
  ),
}))
vi.mock('./product-research', async (original) => ({
  ...(await original<typeof ProductResearchModule>()),
  researchProduct: state.research,
  researchProductPreview: state.preview,
}))

const enabled = process.env.RUN_PRODUCT_DB_TESTS === '1'
describe.skipIf(!enabled)(
  'catalog migration and cross-worker deduplication (isolated PostgreSQL schema)',
  () => {
    const schema = `product_test_${randomUUID().replaceAll('-', '')}`
    let pool: Pool
    let setup: Pool
    let created = false
    beforeAll(async () => {
      const url =
        process.env.PRODUCT_TEST_DATABASE_URL ?? process.env.DATABASE_URL!
      if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
        throw new Error('Integration tests require a local database.')
      setup = new Pool({ connectionString: url })
      await setup.query(`CREATE SCHEMA "${schema}"`)
      created = true
      pool = new Pool({
        connectionString: url,
        options: `-c search_path=${schema}`,
      })
      await pool.query(
        'CREATE TABLE boat_asset (id TEXT PRIMARY KEY); CREATE TABLE boat_document_version (id TEXT PRIMARY KEY);',
      )
      await pool.query(
        await readFile(
          'prisma/migrations/20260913010000_shared_product_catalog/migration.sql',
          'utf8',
        ),
      )
      await pool.query(
        await readFile(
          'prisma/migrations/20260914080000_catalog_brands/migration.sql',
          'utf8',
        ),
      )
      state.client = new PrismaClient({
        adapter: new PrismaPg(pool, { schema }),
      })
    })
    afterAll(async () => {
      if (state.client) await state.client.$disconnect()
      if (pool) await pool.end()
      if (setup) {
        if (created)
          await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
        await setup.end()
      }
    })
    it('creates one product for simultaneous additions and retains meaningful model variants', async () => {
      const [a, b] = await Promise.all([
        resolveProduct('Quark Elec', 'QK-A026+'),
        resolveProduct('Quark-Elec', 'QK A026+'),
      ])
      expect(a.id).toBe(b.id)
      expect((await resolveProduct('Quark-Elec', 'QK-A026')).id).not.toBe(a.id)
      const brand = await state.client.brand.findUniqueOrThrow({
        where: { id: 'quark-elec' },
      })
      expect(brand).toMatchObject({
        canonicalName: 'Quark-Elec',
        aliases: ['Quark Elec', 'QuarkElec'],
        source: 'catalog',
        reviewStatus: 'verified',
      })
      expect(a.brandKey).toBe(brand.id)
    })
    it('runs AI once across concurrent workers, then serves the persisted result', async () => {
      const product = await resolveProduct('Garmin', 'GPSMAP 923')
      let finish!: (value: unknown) => void
      const pending = new Promise((resolve) => {
        finish = resolve
      })
      let started!: () => void
      const didStart = new Promise<void>((resolve) => {
        started = resolve
      })
      state.research.mockImplementationOnce(() => {
        started()
        return pending
      })
      const first = ensureProductResearch(product.id)
      await didStart
      await expect(ensureProductResearch(product.id)).rejects.toBeInstanceOf(
        ProductResearchBusy,
      )
      const result = {
        name: 'Chartplotter',
        description: 'Public info',
        category: 'Navigation',
        specifications: [],
        sources: [{ title: 'Garmin', url: 'https://www.garmin.com/' }],
        documents: [],
      }
      finish(result)
      await first
      expect(await ensureProductResearch(product.id)).toEqual(result)
      expect(state.research).toHaveBeenCalledOnce()
    })
    it('persists photo discovery independently and still runs opted-in document research', async () => {
      const product = await resolveProduct('Test Marine', 'Preview-100')
      const result = {
        name: 'Display',
        description: 'Public display',
        category: 'Navigation',
        specifications: [],
        sources: [
          { title: 'Manufacturer', url: 'https://example.com/display' },
        ],
        documents: [
          {
            title: 'Product image',
            url: 'https://example.com/display.jpg',
            purpose: 'photo',
            languages: [],
            revision: null,
            modelNumbers: ['Preview-100'],
            reason: 'Official image',
          },
        ],
      }
      state.preview.mockResolvedValueOnce(result)
      await ensureProductResearch(product.id, 'en', true)
      const preview = await getProduct(product.id, 'sv')
      expect(preview?.info?.name).toBe('Display')
      expect(preview?.previewImageUrl).toContain('/resources/')
      expect(preview?.createdAt).toBe(product.createdAt.toISOString())
      expect(
        (
          await state.client.productLocale.findFirst({
            where: { productId: product.id },
          })
        )?.status,
      ).toBe('preview')
      await ensureProductResearch(product.id, 'en', true)
      expect(state.preview).toHaveBeenCalledOnce()
      state.research.mockResolvedValueOnce({
        ...result,
        documents: [
          {
            ...result.documents[0],
            title: 'Instructions',
            purpose: 'manual',
            url: 'https://example.com/display.pdf',
            languages: ['en'],
          },
        ],
      })
      await ensureProductResearch(product.id, 'en', false, true)
      expect(
        (await getProduct(product.id))?.resources.some(
          (item) => item.purpose === 'manual',
        ),
      ).toBe(true)
      expect(
        (
          await state.client.productLocale.findFirst({
            where: { productId: product.id },
          })
        )?.status,
      ).toBe('completed')
    })

    async function editableProduct(model = 'Edit-100') {
      const product = await resolveProduct('Test Marine', model)
      await state.client.productLocale.create({
        data: {
          productId: product.id,
          language: 'en',
          status: 'completed',
          result: {
            name: 'Freshwater pressure pump',
            description: 'Cabin water supply',
            category: 'Plumbing',
            specifications: [],
            sources: [
              { title: 'Manufacturer', url: 'https://example.com/pump' },
            ],
            documents: [],
          },
        },
      })
      return (await getAdminProduct(product.id))!
    }
    function editInput(
      product: NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>,
    ) {
      return productAdminEditSchema.parse({
        updatedAt: product.updatedAt,
        brand: product.brand,
        modelNumber: product.modelNumber,
        reviewStatus: product.reviewStatus,
        canonicalImageId: null,
        aliases: product.aliases,
        locales: product.locales
          .filter((item) => item.info)
          .map(({ language, updatedAt, info }) => ({
            language,
            updatedAt,
            info,
          })),
        resources: product.resources,
      })
    }
    it('finds products beyond the first hundred, including aliases and localized text', async () => {
      await state.client.brand.create({
        data: {
          id: 'pagination',
          canonicalName: 'Pagination',
          source: 'user',
        },
      })
      await state.client.catalogProduct.createMany({
        data: Array.from({ length: 105 }, (_, index) => ({
          brand: 'Pagination',
          brandKey: 'pagination',
          modelNumber: `Model ${index}`,
          modelKey: `model${index}`,
        })),
      })
      const product = await editableProduct('Search-100')
      await state.client.productAlias.create({
        data: {
          productId: product.id,
          brandKey: 'test marine',
          modelKey: 'alternativepump',
          label: 'Alternative Pump',
        },
      })
      expect(
        (await searchAdminProducts('alternative-pump', 'all', 1)).products.map(
          (item) => item.id,
        ),
      ).toContain(product.id)
      expect(
        (await searchAdminProducts('FRESHWATER cabin', 'all', 1)).products.map(
          (item) => item.id,
        ),
      ).toContain(product.id)
      const page = await searchAdminProducts('Pagination', 'all', 5)
      expect(page.total).toBe(105)
      expect(page.products).toHaveLength(5)
    })
    it('saves shared facts, aliases and resource metadata without exposing private assets', async () => {
      const product = await editableProduct()
      const input = editInput(product)
      input.locales[0].info.specifications = [
        { name: 'Flow', value: '12', unit: 'L/min' },
      ]
      input.aliases = ['E100']
      input.reviewStatus = 'verified'
      input.resources.push({
        title: 'Instructions',
        sourceUrl: 'https://example.com/manual.pdf',
        purpose: 'manual',
        languages: ['en'],
        revision: '2',
        modelNumbers: ['Edit-100'],
        reason: 'Installation instructions',
        reviewStatus: 'verified',
      })
      const saved = (await editAdminProduct(product.id, input, 'admin'))!
      expect(saved.locales[0].info?.specifications[0].value).toBe('12')
      expect(saved.aliases).toEqual(['E100'])
      expect(saved.resources[0].revision).toBe('2')
      expect(saved.reviewedBy).toBe('admin')
      expect(saved).not.toHaveProperty('assets')
      expect(saved.resources[0]).not.toHaveProperty('originalS3Key')
      await expect(
        editAdminProduct(product.id, input, 'other-admin'),
      ).rejects.toThrow('changed since')
    })
    it('does not overwrite a locale completed after the admin opened the panel', async () => {
      const product = await editableProduct('Locale-100')
      await state.client.productLocale.updateMany({
        where: { productId: product.id },
        data: { updatedAt: new Date(Date.now() + 1000) },
      })
      await expect(
        editAdminProduct(product.id, editInput(product), 'admin'),
      ).rejects.toThrow('Information in en changed')
    })
    it('rolls back identity changes if a model or alias belongs to another product', async () => {
      const product = await editableProduct('Conflict-100')
      await resolveProduct('Test Marine', 'Taken-200')
      const input = editInput(product)
      input.aliases = ['Taken 200']
      await expect(
        editAdminProduct(product.id, input, 'admin'),
      ).rejects.toThrow('already belongs')
      expect((await getAdminProduct(product.id))?.updatedAt).toBe(
        product.updatedAt,
      )
    })
    it('invalidates cached bytes when an admin corrects a document URL', async () => {
      const product = await editableProduct('Source-100')
      await state.client.productResource.create({
        data: {
          productId: product.id,
          title: 'Old manual',
          sourceUrl: 'https://example.com/old.pdf',
          purpose: 'manual',
          languages: [],
          modelNumbers: [],
          reason: '',
          originalS3Key: 'products/old.pdf',
          mimeType: 'application/pdf',
        },
      })
      const input = editInput((await getAdminProduct(product.id))!)
      input.resources[0].sourceUrl = 'https://example.com/correct.pdf'
      await editAdminProduct(product.id, input, 'admin')
      const resource = await state.client.productResource.findFirstOrThrow({
        where: { productId: product.id },
      })
      expect(resource.sourceUrl).toBe('https://example.com/correct.pdf')
      expect(resource.originalS3Key).toBeNull()
      expect(resource.mimeType).toBeNull()
    })
  },
)
