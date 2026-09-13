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
  ProductResearchBusy,
  resolveProduct,
} from './product-catalog'

const state = vi.hoisted(() => ({
  client: null as unknown as PrismaClient,
  research: vi.fn(),
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
  },
)
