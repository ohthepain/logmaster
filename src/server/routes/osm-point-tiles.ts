import { Hono } from 'hono'
import {
  OSM_POINT_DATASETS
  
} from '../../lib/map-data-layers'
import type {OsmPointDatasetId} from '../../lib/map-data-layers';
import { s3Client } from '../lib/s3-client'
import { serveS3GeoJsonTile } from '../lib/s3-geojson-tile-response'

export const osmPointTileRoutes = new Hono()

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
    return serveS3GeoJsonTile(s3Client, bucket, key, 'osm-points')
  },
)
