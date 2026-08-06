export type MapBbox = {
  west: number
  south: number
  east: number
  north: number
}

export type MapRegionId = 'uk' | 'europe' | 'north-america' | 'canada'

export type MapLayerId = 'geonames-cities' | 'osm-marinas'

export type MapLayerDefinition = {
  id: MapLayerId
  title: string
  description: string
  output: string
}

export type MapRegionDefinition = {
  id: MapRegionId
  label: string
  description: string
  bbox: MapBbox
  /** Approximate count of 1° S3 tile folders covered by this bbox. */
  degreeTileCount: number
  /** Approximate Overpass grid cells at 3° step (when marinas layer applies). */
  overpassCellCount: number
  layers: Record<
    MapLayerId,
    { available: true } | { available: false; reason: string }
  >
}

/** Great Britain, Northern Ireland, and nearby coasts — fast builds for UK dev. */
export const UK_MAP_BBOX: MapBbox = {
  west: -8.2,
  south: 49.9,
  east: 1.8,
  north: 60.9,
}

export const EUROPE_MAP_BBOX: MapBbox = {
  west: -9,
  south: 35,
  east: 40,
  north: 72,
}

export const NORTH_AMERICA_MAP_BBOX: MapBbox = {
  west: -170,
  south: 15,
  east: -50,
  north: 72,
}

export const CANADA_MAP_BBOX: MapBbox = {
  west: -141,
  south: 42,
  east: -52,
  north: 72,
}

export const MAP_LAYERS: MapLayerDefinition[] = [
  {
    id: 'geonames-cities',
    title: 'Place labels',
    description: 'GeoNames cities5000 → highres / lowres label tiles.',
    output: 'v1/tiles/highres.json.gz, lowres.json.gz',
  },
  {
    id: 'osm-marinas',
    title: 'Marinas',
    description: 'OSM leisure=marina via Overpass → tappable marina points.',
    output: 'v1/tiles/marinas.json.gz',
  },
]

function estimateDegreeTileCount(bbox: MapBbox): number {
  const latTiles = Math.max(1, Math.ceil(bbox.north - bbox.south))
  const lonTiles = Math.max(1, Math.ceil(bbox.east - bbox.west))
  return latTiles * lonTiles
}

function estimateOverpassCellCount(bbox: MapBbox, gridStep = 3): number {
  let count = 0
  for (let south = bbox.south; south < bbox.north; south += gridStep) {
    for (let west = bbox.west; west < bbox.east; west += gridStep) {
      count += 1
    }
  }
  return count
}

function buildRegion(
  definition: Omit<
    MapRegionDefinition,
    'degreeTileCount' | 'overpassCellCount'
  >,
): MapRegionDefinition {
  return {
    ...definition,
    degreeTileCount: estimateDegreeTileCount(definition.bbox),
    overpassCellCount: estimateOverpassCellCount(definition.bbox),
  }
}

export const MAP_REGIONS: MapRegionDefinition[] = [
  buildRegion({
    id: 'uk',
    label: 'United Kingdom',
    description:
      'Subset of Europe — quick builds around the default dev location (Cowes).',
    bbox: UK_MAP_BBOX,
    layers: {
      'geonames-cities': { available: true },
      'osm-marinas': { available: true },
    },
  }),
  buildRegion({
    id: 'europe',
    label: 'Europe',
    description: 'GeoNames place labels for the full European bbox.',
    bbox: EUROPE_MAP_BBOX,
    layers: {
      'geonames-cities': { available: true },
      'osm-marinas': { available: false, reason: 'Use United Kingdom for now.' },
    },
  }),
  buildRegion({
    id: 'north-america',
    label: 'North America',
    description: 'Continental US, Canada, Mexico, Caribbean coasts, Alaska.',
    bbox: NORTH_AMERICA_MAP_BBOX,
    layers: {
      'geonames-cities': {
        available: false,
        reason: 'GeoNames builds are configured for Europe / UK.',
      },
      'osm-marinas': { available: true },
    },
  }),
  buildRegion({
    id: 'canada',
    label: 'Canada (quick test)',
    description: 'Smaller North American bbox for faster marina Overpass runs.',
    bbox: CANADA_MAP_BBOX,
    layers: {
      'geonames-cities': {
        available: false,
        reason: 'GeoNames builds are configured for Europe / UK.',
      },
      'osm-marinas': { available: true },
    },
  }),
]

export const DEFAULT_MAP_REGION_ID: MapRegionId = 'uk'

const regionById = new Map<MapRegionId, MapRegionDefinition>(
  MAP_REGIONS.map((region) => [region.id, region]),
)

export function getMapRegion(id: MapRegionId): MapRegionDefinition {
  const region = regionById.get(id)
  if (!region) {
    throw new Error(`Unknown map region "${id}"`)
  }
  return region
}

export function isMapRegionId(value: string): value is MapRegionId {
  return regionById.has(value as MapRegionId)
}

export function formatMapBbox(bbox: MapBbox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
}

export function mapRegionLabel(regionId: MapRegionId | string | undefined): string {
  if (!regionId || !isMapRegionId(regionId)) return String(regionId ?? 'unknown')
  return getMapRegion(regionId).label
}

export function availableLayersForRegion(
  region: MapRegionDefinition,
): MapLayerDefinition[] {
  return MAP_LAYERS.filter((layer) => region.layers[layer.id]?.available === true)
}

export function defaultLayersForRegion(region: MapRegionDefinition): MapLayerId[] {
  return availableLayersForRegion(region).map((layer) => layer.id)
}

export function marinaRegionForMapRegion(
  regionId: MapRegionId,
): 'uk' | 'canada' | 'north-america' {
  if (regionId === 'canada') return 'canada'
  if (regionId === 'north-america') return 'north-america'
  if (regionId === 'uk') return 'uk'
  throw new Error(`Region "${regionId}" does not support marina builds`)
}
