import 'dotenv/config'
import { Hono } from 'hono'
import { s3Client } from '../lib/s3-client'
import { serveS3GeoJsonTile } from '../lib/s3-geojson-tile-response'

export const geoFeatureRoutes = new Hono()

function isTilePart(value: string, hemisphere: 'lat' | 'lon'): boolean {
  return hemisphere === 'lat'
    ? /^[NS]\d{1,2}$/.test(value)
    : /^[EW]\d{1,3}$/.test(value)
}

function isResolutionFile(
  value: string,
): value is 'highres.json.gz' | 'lowres.json.gz' {
  return value === 'highres.json.gz' || value === 'lowres.json.gz'
}

geoFeatureRoutes.get('/:lat/:lon/v1/tiles/:file', async (c) => {
  const bucket = process.env.S3_BUCKET_GEOJSON?.trim()
  if (!bucket) return c.text('Set S3_BUCKET_GEOJSON in .env', 503)

  const lat = c.req.param('lat')
  const lon = c.req.param('lon')
  const file = c.req.param('file')
  if (
    !isTilePart(lat, 'lat') ||
    !isTilePart(lon, 'lon') ||
    !isResolutionFile(file)
  ) {
    return c.text('Invalid geo feature tile', 400)
  }

  const key = `${lat}/${lon}/v1/tiles/${file}`
  return serveS3GeoJsonTile(s3Client, bucket, key, 'geo-features')
})
