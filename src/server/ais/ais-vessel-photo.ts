const PHOTO_CACHE_MS = 24 * 60 * 60 * 1000

type PhotoCacheEntry = {
  photoUrl: string | null
  fetchedAt: number
}

const photoCache = new Map<string, PhotoCacheEntry>()

function readOgImage(html: string): string | null {
  const patterns = [
    /property="og:image"\s+content="([^"]+)"/i,
    /content="([^"]+)"\s+property="og:image"/i,
    /property='og:image'\s+content='([^']+)'/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/** Best-effort vessel photo via VesselFinder (no API key). Returns null when unavailable. */
export async function resolveAisVesselPhotoUrl(
  mmsi: string,
  name?: string | null,
): Promise<string | null> {
  if (!/^\d{9}$/.test(mmsi)) return null

  const cached = photoCache.get(mmsi)
  if (cached && Date.now() - cached.fetchedAt < PHOTO_CACHE_MS) {
    return cached.photoUrl
  }

  let photoUrl: string | null = null
  try {
    const response = await fetch(`https://www.vesselfinder.com/vessels/details/${mmsi}`, {
      headers: {
        'User-Agent': 'logmaster/1.0 (+https://logmaster.live)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) {
      const html = await response.text()
      photoUrl = readOgImage(html)
    }
  } catch {
    photoUrl = null
  }

  if (!photoUrl && name?.trim()) {
    try {
      const query = encodeURIComponent(`${name.trim()} ship`)
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=640&generator=search&gsrsearch=${query}&gsrlimit=1`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (response.ok) {
        const payload = (await response.json()) as {
          query?: { pages?: Record<string, { thumbnail?: { source?: string } }> }
        }
        const pages = payload.query?.pages ?? {}
        photoUrl = Object.values(pages)[0]?.thumbnail?.source ?? null
      }
    } catch {
      photoUrl = null
    }
  }

  photoCache.set(mmsi, { photoUrl, fetchedAt: Date.now() })
  return photoUrl
}

export function resetAisVesselPhotoCacheForTests() {
  photoCache.clear()
}
