export type FlickrPhotoAttribution = {
  displayName: string
  uri: string | null
}

export type FlickrPhoto = {
  id: string
  title: string
  widthPx: number
  heightPx: number
  mediaUrl: string
  pageUrl: string
  authorAttributions: FlickrPhotoAttribution[]
}

export type FlickrPhotosResult = {
  queryLabel: string
  photos: FlickrPhoto[]
}

type FlickrSearchPhoto = {
  id?: string
  owner?: string
  secret?: string
  server?: string
  farm?: number
  title?: string
  width_o?: string
  height_o?: string
  width_k?: string
  height_k?: string
  width_h?: string
  height_h?: string
  width_l?: string
  height_l?: string
  width_m?: string
  height_m?: string
  url_o?: string
  url_k?: string
  url_h?: string
  url_l?: string
  url_m?: string
  ownername?: string
}

type FlickrSearchResponse = {
  stat?: string
  message?: string
  photos?: {
    photo?: FlickrSearchPhoto[]
  }
}

const FLICKR_API = 'https://api.flickr.com/services/rest/'
const MAX_PHOTOS = 20

export function getFlickrApiKey(): string | null {
  const value = process.env.FLICKR_API_KEY?.trim()
  return value || null
}

export function isFlickrConfigured(): boolean {
  return Boolean(getFlickrApiKey())
}

function parseDimension(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function pickFlickrMedia(photo: FlickrSearchPhoto): {
  mediaUrl: string
  widthPx: number
  heightPx: number
} | null {
  const candidates = [
    {
      mediaUrl: photo.url_o,
      widthPx: parseDimension(photo.width_o),
      heightPx: parseDimension(photo.height_o),
    },
    {
      mediaUrl: photo.url_k,
      widthPx: parseDimension(photo.width_k),
      heightPx: parseDimension(photo.height_k),
    },
    {
      mediaUrl: photo.url_h,
      widthPx: parseDimension(photo.width_h),
      heightPx: parseDimension(photo.height_h),
    },
    {
      mediaUrl: photo.url_l,
      widthPx: parseDimension(photo.width_l),
      heightPx: parseDimension(photo.height_l),
    },
    {
      mediaUrl: photo.url_m,
      widthPx: parseDimension(photo.width_m),
      heightPx: parseDimension(photo.height_m),
    },
  ]

  for (const candidate of candidates) {
    if (candidate.mediaUrl?.trim()) {
      return {
        mediaUrl: candidate.mediaUrl.trim(),
        widthPx: candidate.widthPx,
        heightPx: candidate.heightPx,
      }
    }
  }

  const id = photo.id?.trim()
  const secret = photo.secret?.trim()
  const server = photo.server?.trim()
  if (!id || !secret || !server) return null

  return {
    mediaUrl: `https://live.staticflickr.com/${server}/${id}_${secret}_b.jpg`,
    widthPx: 0,
    heightPx: 0,
  }
}

function normalizeFlickrPhoto(photo: FlickrSearchPhoto): FlickrPhoto | null {
  const id = photo.id?.trim()
  const owner = photo.owner?.trim()
  if (!id || !owner) return null

  const media = pickFlickrMedia(photo)
  if (!media) return null

  const ownerName = photo.ownername?.trim() || 'Flickr user'
  const pageUrl = `https://www.flickr.com/photos/${owner}/${id}`

  return {
    id,
    title: photo.title?.trim() || 'Untitled',
    widthPx: media.widthPx,
    heightPx: media.heightPx,
    mediaUrl: media.mediaUrl,
    pageUrl,
    authorAttributions: [
      {
        displayName: ownerName,
        uri: pageUrl,
      },
    ],
  }
}

export async function fetchFlickrPhotos(
  latitude: number,
  longitude: number,
  name?: string | null,
): Promise<FlickrPhotosResult | null> {
  const apiKey = getFlickrApiKey()
  if (!apiKey) return null

  const trimmedName = name?.trim()
  const url = new URL(FLICKR_API)
  url.searchParams.set('method', 'flickr.photos.search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('nojsoncallback', '1')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('radius', trimmedName ? '3' : '2')
  url.searchParams.set('radius_units', 'km')
  url.searchParams.set('content_type', '1')
  url.searchParams.set('media', 'photos')
  url.searchParams.set('safe_search', '1')
  url.searchParams.set('sort', trimmedName ? 'relevance' : 'interestingness-desc')
  url.searchParams.set('per_page', String(MAX_PHOTOS))
  url.searchParams.set(
    'extras',
    'url_o,url_k,url_h,url_l,url_m,owner_name,description',
  )
  if (trimmedName) url.searchParams.set('text', trimmedName)

  const response = await fetch(url.toString())
  if (!response.ok) return null

  const json = (await response.json()) as FlickrSearchResponse
  if (json.stat !== 'ok') return null

  const photos = (json.photos?.photo ?? [])
    .flatMap((photo) => {
      const normalized = normalizeFlickrPhoto(photo)
      return normalized ? [normalized] : []
    })
    .slice(0, MAX_PHOTOS)

  return {
    queryLabel: trimmedName ?? 'Nearby photos',
    photos,
  }
}
