import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { MapDataLayerId } from '../../../lib/map-data-layers'
import { getMapDataLayer } from '../../../lib/map-data-layers'
import {
  fetchPlacePhotos,
  placePhotoMediaUrl,
  type PlacePhoto,
  type PlacePhotoAttribution,
} from '../../../lib/places-photos-api'

type PlacePhotosSearch = {
  lat: number
  lon: number
  name?: string
  layer?: MapDataLayerId
}

function parseSearch(search: Record<string, unknown>): PlacePhotosSearch | null {
  const lat = Number(search.lat)
  const lon = Number(search.lon)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null

  const name =
    typeof search.name === 'string' && search.name.trim()
      ? search.name.trim()
      : undefined

  const layer =
    typeof search.layer === 'string' ? (search.layer as MapDataLayerId) : undefined

  return { lat, lon, name, layer }
}

export const Route = createFileRoute('/_main/places/photos')({
  validateSearch: (search: Record<string, unknown>) =>
    parseSearch(search) ?? { lat: 0, lon: 0 },
  component: PlacePhotosPage,
})

function PlacePhotosPage() {
  const search = Route.useSearch()
  const validSearch = useMemo(() => parseSearch(search), [search])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PlacePhoto[]>([])

  const layerTitle = useMemo(() => {
    if (!validSearch?.layer) return null
    try {
      return getMapDataLayer(validSearch.layer).title
    } catch {
      return null
    }
  }, [validSearch?.layer])

  useEffect(() => {
    if (!validSearch) {
      setLoading(false)
      setError('Missing or invalid location for this place.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetchPlacePhotos({
      latitude: validSearch.lat,
      longitude: validSearch.lon,
      name: validSearch.name,
    })
      .then((result: Awaited<ReturnType<typeof fetchPlacePhotos>>) => {
        if (cancelled) return
        setConfigured(result.configured)
        if (!result.configured) {
          setError(
            result.error ??
              'Place photos are not available because Google Places is not configured.',
          )
          setPhotos([])
          setPlaceName(validSearch.name ?? null)
          return
        }
        setPlaceName(result.place?.name ?? validSearch.name ?? 'Place')
        setPhotos(result.photos ?? [])
        if ((result.photos?.length ?? 0) === 0 && result.message) {
          setError(result.message)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load photos')
        setPhotos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [validSearch])

  const title = placeName ?? validSearch?.name ?? 'Place photos'

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <p className="mb-2 text-sm">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="border-0 bg-transparent p-0 text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
        >
          ← Back
        </button>
      </p>

      <h1 className="brand-title m-0 text-[2rem] leading-tight sm:text-[2.35rem]">
        {title}
      </h1>
      {layerTitle ? (
        <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">{layerTitle}</p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">Loading photos…</p>
      ) : null}

      {!loading && error ? (
        <p className="mt-6 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}

      {!loading && !error && configured && photos.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sea-ink-soft)]">
          No Google Maps photos were found for this location. Check that Places
          API (New) Place Details Pro is enabled for photo access.
        </p>
      ) : null}

      {!loading && photos.length > 0 ? (
        <div className="mt-6 flex flex-col gap-8">
          {photos.map((photo) => (
            <figure key={photo.name} className="m-0">
              <img
                src={placePhotoMediaUrl(photo.mediaUrl)}
                alt={title}
                loading="lazy"
                className="block w-full rounded-xl bg-[var(--surface-muted)] object-cover"
                style={{
                  aspectRatio:
                    photo.widthPx > 0 && photo.heightPx > 0
                      ? `${photo.widthPx} / ${photo.heightPx}`
                      : '4 / 3',
                  maxHeight: '72vh',
                }}
              />
              {photo.authorAttributions.length > 0 ? (
                <figcaption className="mt-2 text-xs leading-5 text-[var(--sea-ink-soft)]">
                  {photo.authorAttributions.map((attribution: PlacePhotoAttribution) =>
                    attribution.uri ? (
                      <a
                        key={`${photo.name}-${attribution.displayName}`}
                        href={attribution.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--lagoon-deep)] underline decoration-[var(--lagoon-deep)]/40 underline-offset-2"
                      >
                        {attribution.displayName}
                      </a>
                    ) : (
                      <span key={`${photo.name}-${attribution.displayName}`}>
                        {attribution.displayName}
                      </span>
                    ),
                  )}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      {!loading && configured && photos.length > 0 ? (
        <p className="mt-8 text-xs leading-5 text-[var(--sea-ink-soft)]">
          Photos provided by{' '}
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--lagoon-deep)] underline decoration-[var(--lagoon-deep)]/40 underline-offset-2"
          >
            Google Maps
          </a>
          .
        </p>
      ) : null}

      {!validSearch ? (
        <p className="mt-6">
          <Link to="/map" className="text-sm text-[var(--sea-ink)]">
            Open map
          </Link>
        </p>
      ) : null}
    </main>
  )
}
