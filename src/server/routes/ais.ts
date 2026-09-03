import { Hono } from 'hono'
import { getAisVesselByMmsi } from '../ais/ais-vessel-cache'
import { resolveAisVesselPhotoUrl } from '../ais/ais-vessel-photo'
import {
  fetchAisVesselsForBoundingBox,
  getAisVesselCacheSize,
  isAisStreamConfigured,
  parseBoundingBox,
} from '../ais/ais-vessels'
import {
  AIS_VESSEL_CATEGORY_COLORS,
  AIS_VESSEL_CATEGORY_LABELS,
} from '../../domain/ais-vessel-categories'

export const aisRoutes = new Hono()

function isValidMmsi(value: string) {
  return /^\d{9}$/.test(value)
}

aisRoutes.get('/vessels', async (c) => {
  if (!isAisStreamConfigured()) {
    return c.json(
      {
        configured: false,
        error: 'AIS live feed is not configured on this server.',
        type: 'FeatureCollection',
        features: [],
      },
      503,
    )
  }

  const bbox = parseBoundingBox({
    north: c.req.query('north'),
    south: c.req.query('south'),
    east: c.req.query('east'),
    west: c.req.query('west'),
  })
  if (!bbox) {
    return c.json({ error: 'Invalid bounding box' }, 400)
  }

  const result = await fetchAisVesselsForBoundingBox(bbox)
  return c.json({
    configured: result.configured,
    type: result.collection.type,
    features: result.collection.features,
  })
})

aisRoutes.get('/vessels/:mmsi', async (c) => {
  const mmsi = c.req.param('mmsi')
  if (!isValidMmsi(mmsi)) {
    return c.json({ error: 'Invalid MMSI' }, 400)
  }

  const vessel = getAisVesselByMmsi(mmsi)
  const photoUrl = await resolveAisVesselPhotoUrl(mmsi, vessel?.name)

  return c.json({
    configured: isAisStreamConfigured(),
    vessel,
    photoUrl,
    categoryColor: vessel ? AIS_VESSEL_CATEGORY_COLORS[vessel.category] : null,
    categoryLabel: vessel ? AIS_VESSEL_CATEGORY_LABELS[vessel.category] : null,
    links: {
      marineTraffic: `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`,
      vesselFinder: `https://www.vesselfinder.com/?mmsi=${mmsi}`,
    },
  })
})

aisRoutes.get('/status', (c) =>
  c.json({
    configured: isAisStreamConfigured(),
    cachedVessels: getAisVesselCacheSize(),
  }),
)
