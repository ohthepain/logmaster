import type { TripTrack, TripTrackPayload } from '../domain/trip-track'
import { normalizeTripTrack } from '../domain/trip-track'
import { apiUrl } from './app-origin'
import { putTripTrack } from './logbook-idb'
import {
  deserializeTrackPayload,
  serializeTrackPayload,
  stripTrackPayloadForManifest,
  trackNeedsS3Offload,
  trackS3Key,
} from './trip-track-payload'

async function fetchSessionUserId(): Promise<string | null> {
  try {
    const response = await fetch(apiUrl('/api/profile'), {
      credentials: 'include',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { user?: { id?: string } }
    return body.user?.id ?? null
  } catch {
    return null
  }
}

export async function prepareTrackForUpload(
  track: TripTrack,
  userId: string | null,
): Promise<TripTrack> {
  const normalized = normalizeTripTrack(track)
  if (!normalized.payload) return normalized
  if (normalized.storage === 's3' && normalized.storageKey) return normalized

  const serialized = await serializeTrackPayload(normalized.payload)
  if (!trackNeedsS3Offload(serialized.byteLength) || !userId) {
    return {
      ...normalized,
      byteLength: serialized.byteLength,
      sha256: serialized.sha256,
      storage: 'inline',
      storageKey: null,
    }
  }

  const storageKey = trackS3Key(userId, normalized.tripId, normalized.id)
  const uploadResponse = await fetch(
    apiUrl(`/api/logbook/tracks/${normalized.id}/content`),
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Track-Sha256': serialized.sha256,
        'X-Track-Storage-Key': storageKey,
      },
      body: new Blob([serialized.bytes as BlobPart]),
    },
  )
  if (!uploadResponse.ok) {
    throw new Error(await uploadResponse.text())
  }

  return {
    ...normalized,
    payload: null,
    storage: 's3',
    storageKey,
    byteLength: serialized.byteLength,
    sha256: serialized.sha256,
  }
}

export async function syncPendingTripTracks(
  tracks: TripTrack[],
): Promise<TripTrack[]> {
  if (tracks.length === 0) return []
  const userId = await fetchSessionUserId()
  const prepared = await Promise.all(
    tracks.map((track) => prepareTrackForUpload(track, userId)),
  )

  const response = await fetch(apiUrl('/api/logbook/tracks/sync'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripTracks: prepared.map((track) => stripTrackPayloadForManifest(track)),
    }),
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }

  const body = (await response.json()) as { tripTracks?: TripTrack[] }
  return (body.tripTracks ?? []).map((track) => ({
    ...normalizeTripTrack(track),
    synced: true,
  }))
}

export async function fetchTripTrackManifests(tripId: string): Promise<TripTrack[]> {
  const response = await fetch(apiUrl(`/api/logbook/trips/${tripId}/tracks`), {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const body = (await response.json()) as { tripTracks?: TripTrack[] }
  return (body.tripTracks ?? []).map(normalizeTripTrack)
}

export async function fetchTripTrackPayload(track: TripTrack): Promise<TripTrackPayload> {
  const response = await fetch(apiUrl(`/api/logbook/tracks/${track.id}/content`), {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  return deserializeTrackPayload(bytes)
}

export async function hydrateTripTrackPayload(track: TripTrack): Promise<TripTrack> {
  if (track.payload) return track
  if (track.storage !== 's3') return track
  const payload = await fetchTripTrackPayload(track)
  const hydrated = { ...track, payload }
  await putTripTrack(hydrated)
  return hydrated
}

export function mergeTrackManifests(
  localTracks: TripTrack[],
  serverTracks: TripTrack[],
): TripTrack[] {
  const localById = new Map(localTracks.map((track) => [track.id, track]))
  const merged = serverTracks.map((serverTrack) => {
    const local = localById.get(serverTrack.id)
    if (local?.payload) {
      return { ...serverTrack, payload: local.payload, synced: local.synced }
    }
    return serverTrack
  })
  for (const localTrack of localTracks) {
    if (!merged.some((track) => track.id === localTrack.id)) {
      merged.push(localTrack)
    }
  }
  return merged.sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )
}

export function stripRemoteTrackPayloads(tracks: TripTrack[]): TripTrack[] {
  return tracks.map(stripTrackPayloadForManifest)
}
