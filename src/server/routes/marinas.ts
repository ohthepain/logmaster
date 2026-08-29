import { Hono } from 'hono'
import { s3Client } from '../lib/s3-client'
import { serveS3GeoJsonTile } from '../lib/s3-geojson-tile-response'

export const marinaRoutes = new Hono()

function isTilePart(value: string, hemisphere: 'lat' | 'lon'): boolean {
  return hemisphere === 'lat'
    ? /^[NS]\d{1,2}$/.test(value)
    : /^[EW]\d{1,3}$/.test(value)
}

marinaRoutes.get('/:lat/:lon/v1/tiles/marinas.json.gz', async (c) => {
  const bucket = process.env.S3_BUCKET_GEOJSON?.trim()
  if (!bucket) return c.text('Set S3_BUCKET_GEOJSON in .env', 503)

  const lat = c.req.param('lat')
  const lon = c.req.param('lon')
  if (!isTilePart(lat, 'lat') || !isTilePart(lon, 'lon')) {
    return c.text('Invalid marina tile', 400)
  }

  const key = `${lat}/${lon}/v1/tiles/marinas.json.gz`
  return serveS3GeoJsonTile(s3Client, bucket, key, 'marinas')
})
