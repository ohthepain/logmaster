import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3'
import { Hono } from 'hono'
import {
  OSM_POINT_DATASETS
  
} from '../../lib/map-data-layers'
import type {OsmPointDatasetId} from '../../lib/map-data-layers';

export const osmPointTileRoutes = new Hono()

const s3 = new S3Client({
  region:
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
})

function isTilePart(value: string, hemisphere: 'lat' | 'lon'): boolean {
  return hemisphere === 'lat'
    ? /^[NS]\d{1,2}$/.test(value)
    : /^[EW]\d{1,3}$/.test(value)
}

function isDatasetId(value: string): value is OsmPointDatasetId {
  return value in OSM_POINT_DATASETS && value !== 'marinas'
}

osmPointTileRoutes.get(
  '/:dataset/:lat/:lon/v1/tiles/:filename',
  async (c) => {
    const bucket = process.env.S3_BUCKET_GEOJSON?.trim()
    if (!bucket) return c.text('Set S3_BUCKET_GEOJSON in .env', 503)

    const dataset = c.req.param('dataset')
    if (!isDatasetId(dataset)) {
      return c.text('Invalid OSM point dataset', 400)
    }

    const meta = OSM_POINT_DATASETS[dataset]
    const filename = c.req.param('filename')
    if (filename !== meta.tileFile) {
      return c.text('Invalid tile filename for dataset', 400)
    }

    const lat = c.req.param('lat')
    const lon = c.req.param('lon')
    if (!isTilePart(lat, 'lat') || !isTilePart(lon, 'lon')) {
      return c.text('Invalid tile coordinates', 400)
    }

    const key = `${lat}/${lon}/v1/tiles/${filename}`
    try {
      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      )
      const bytes = await response.Body?.transformToByteArray()
      if (!bytes) return c.text('Missing tile body', 502)

      return new Response(new Uint8Array(bytes), {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'Content-Type': response.ContentType ?? 'application/geo+json',
          'Content-Encoding': response.ContentEncoding ?? 'gzip',
        },
      })
    } catch (error) {
      if (
        error instanceof NoSuchKey ||
        (typeof error === 'object' &&
          error != null &&
          'name' in error &&
          (error as { name?: string }).name === 'NoSuchKey')
      ) {
        return c.text('Tile not found', 404)
      }
      console.warn('[osm-points] S3 error', key, error)
      return c.text('Upstream error', 502)
    }
  },
)
