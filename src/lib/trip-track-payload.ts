import type { TripTrack, TripTrackPayload } from '../domain/trip-track'

/** Max samples per sealed chunk during live recording. */
export const TRIP_TRACK_CHUNK_MAX_SAMPLES = 5_000

/** Seal an open chunk after this wall-clock span (ms). */
export const TRIP_TRACK_CHUNK_MAX_MS = 60 * 60 * 1000

/** Payloads larger than this are stored in S3 instead of Postgres JSONB. */
export const TRIP_TRACK_S3_THRESHOLD_BYTES = 32 * 1024

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function gunzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') return data
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function serializeTrackPayload(
  payload: TripTrackPayload,
): Promise<{ bytes: Uint8Array; byteLength: number; sha256: string; compressed: boolean }> {
  const json = JSON.stringify(payload)
  const raw = new TextEncoder().encode(json)
  const bytes = await gzipBytes(raw)
  const compressed = bytes.length < raw.length
  const finalBytes = compressed ? bytes : raw
  return {
    bytes: finalBytes,
    byteLength: finalBytes.length,
    sha256: await sha256Hex(finalBytes),
    compressed,
  }
}

export async function deserializeTrackPayload(bytes: Uint8Array): Promise<TripTrackPayload> {
  let decoded = bytes
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    decoded = await gunzipBytes(bytes)
  }
  const text = new TextDecoder().decode(decoded)
  return JSON.parse(text) as TripTrackPayload
}

export function stripTrackPayloadForManifest(track: TripTrack): TripTrack {
  if (track.storage === 's3') {
    return { ...track, payload: null }
  }
  return track
}

export function trackNeedsS3Offload(byteLength: number): boolean {
  return byteLength > TRIP_TRACK_S3_THRESHOLD_BYTES
}

export function trackS3Key(userId: string, tripId: string, trackId: string): string {
  return `tracks/${userId}/${tripId}/${trackId}.v1.bin`
}
