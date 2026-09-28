import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3'
import { gzipSync } from 'node:zlib'
import {
  MAP_DATA_TILE_CACHE_CONTROL,
  MAP_DATA_TILE_EMPTY_CACHE_CONTROL,
} from '../map-tile-cache'

const EMPTY_GEOJSON_GZ = gzipSync(
  JSON.stringify({ type: 'FeatureCollection', features: [] }),
)

function isNoSuchKey(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    (typeof error === 'object' &&
      error != null &&
      'name' in error &&
      (error as { name?: string }).name === 'NoSuchKey')
  )
}

/** Serve a gzip GeoJSON tile from S3; missing keys return an empty collection (200). */
export async function serveS3GeoJsonTile(
  s3: S3Client,
  bucket: string,
  key: string,
  logLabel: string,
): Promise<Response> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    )
    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) return new Response('Missing tile body', { status: 502 })

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Cache-Control': MAP_DATA_TILE_CACHE_CONTROL,
        'Content-Type': response.ContentType ?? 'application/geo+json',
        'Content-Encoding': response.ContentEncoding ?? 'gzip',
      },
    })
  } catch (error) {
    if (isNoSuchKey(error)) {
      return new Response(EMPTY_GEOJSON_GZ, {
        headers: {
          'Cache-Control': MAP_DATA_TILE_EMPTY_CACHE_CONTROL,
          'Content-Type': 'application/geo+json',
          'Content-Encoding': 'gzip',
        },
      })
    }
    console.warn(`[${logLabel}] S3 error`, key, error)
    return new Response('Upstream error', { status: 502 })
  }
}
