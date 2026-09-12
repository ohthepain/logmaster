import { z } from 'zod'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'

export const categorySchema = z.enum(ASSET_CATEGORIES).nullable()
export const identificationSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000),
  modelNumber: z.string().max(200).nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  category: categorySchema,
})
export const downloadSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z
    .url()
    .max(2048)
    .refine((url) => {
      const parsed = new URL(url)
      return (
        parsed.protocol === 'https:' && !parsed.username && !parsed.password
      )
    }, 'A public HTTPS download URL is required'),
  purpose: z.enum(['manual', 'photo', 'warranty', 'other']),
  reason: z.string().max(1000),
})
export const connectionSchema = z.object({
  assetId: z.string().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
})
export const researchSchema = z.object({
  category: categorySchema,
  downloads: z.array(downloadSchema).max(8),
  connections: z.array(connectionSchema).max(20),
})
export const researchInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(''),
  modelNumber: z.string().trim().min(1).max(200).nullable(),
})
export const createAssetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  modelNumber: z.string().trim().max(200).nullable().optional(),
  category: categorySchema.optional(),
  ownership: z.enum(['BOAT', 'ORG', 'USER', 'EXTERNAL']),
  ownedByUserId: z.string().max(200).nullable().optional(),
  installedAt: z.iso.datetime().nullable().optional(),
  suggestedDownloads: z.array(downloadSchema).max(8).default([]),
  confirmedConnections: z.array(connectionSchema).max(20).default([]),
})
