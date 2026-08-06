export type MapBbox = {
  west: number
  south: number
  east: number
  north: number
}

export type MapRegionId = 'uk' | 'europe' | 'north-america' | 'canada'

/** Layers that can be rebuilt from admin (coarse build targets). */
export type MapBuildLayerId =
  | 'geonames-cities'
  | 'osm-marinas'
  | 'osm-harbours'
  | 'osm-anchorage'
  | 'osm-places'
  | 'osm-seamarks'

export type MapBuildLayerDefinition = {
  id: MapBuildLayerId
  title: string
  description: string
  output: string
  overpass: boolean
}

export type MapRegionDefinition = {
  id: MapRegionId
  label: string
  description: string
  bbox: MapBbox
  degreeTileCount: number
  overpassCellCount: number
  layers: Record<
    MapBuildLayerId,
    { available: true } | { available: false; reason: string }
  >
}

/** @deprecated Use MapBuildLayerId — kept for gradual migration. */
export type MapLayerId = MapBuildLayerId

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

export const MAP_LAYERS: MapBuildLayerDefinition[] = [
  {
    id: 'geonames-cities',
    title: 'Place labels',
    description: 'GeoNames cities5000 → highres / lowres label tiles.',
    output: 'v1/tiles/highres.json.gz, lowres.json.gz',
    overpass: false,
  },
  {
    id: 'osm-marinas',
    title: 'Marinas',
    description: 'OSM leisure=marina and seamark:type=marina.',
    output: 'v1/tiles/marinas.json.gz',
    overpass: true,
  },
  {
    id: 'osm-harbours',
    title: 'Harbours',
    description: 'OSM harbours and seamark:type=harbour.',
    output: 'v1/tiles/harbours.json.gz',
    overpass: true,
  },
  {
    id: 'osm-anchorage',
    title: 'Anchorages',
    description: 'OSM seamark:type=anchorage.',
    output: 'v1/tiles/anchorages.json.gz',
    overpass: true,
  },
  {
    id: 'osm-places',
    title: 'Coastal places',
    description: 'OSM bays, capes, islands, and straits.',
    output: 'v1/tiles/places.json.gz',
    overpass: true,
  },
  {
    id: 'osm-seamarks',
    title: 'Seamarks',
    description: 'OSM buoys, beacons, lights, notices, and wrecks.',
    output: 'v1/tiles/seamarks.json.gz',
    overpass: true,
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

const overpassLayersAvailable = {
  'osm-marinas': { available: true as const },
  'osm-harbours': { available: true as const },
  'osm-anchorage': { available: true as const },
  'osm-places': { available: true as const },
  'osm-seamarks': { available: true as const },
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
      ...overpassLayersAvailable,
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
      'osm-harbours': { available: false, reason: 'Use United Kingdom for now.' },
      'osm-anchorage': { available: false, reason: 'Use United Kingdom for now.' },
      'osm-places': { available: false, reason: 'Use United Kingdom for now.' },
      'osm-seamarks': { available: false, reason: 'Use United Kingdom for now.' },
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
      ...overpassLayersAvailable,
    },
  }),
  buildRegion({
    id: 'canada',
    label: 'Canada (quick test)',
    description: 'Smaller North American bbox for faster Overpass runs.',
    bbox: CANADA_MAP_BBOX,
    layers: {
      'geonames-cities': {
        available: false,
        reason: 'GeoNames builds are configured for Europe / UK.',
      },
      ...overpassLayersAvailable,
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
): MapBuildLayerDefinition[] {
  return MAP_LAYERS.filter((layer) => region.layers[layer.id]?.available === true)
}

export function defaultLayersForRegion(
  region: MapRegionDefinition,
): MapBuildLayerId[] {
  return availableLayersForRegion(region).map((layer) => layer.id)
}

export function marinaRegionForMapRegion(
  regionId: MapRegionId,
): 'uk' | 'canada' | 'north-america' {
  if (regionId === 'canada') return 'canada'
  if (regionId === 'north-america') return 'north-america'
  if (regionId === 'uk') return 'uk'
  throw new Error(`Region "${regionId}" does not support Overpass builds`)
}

export function osmPointsDatasetForBuildLayer(
  layerId: MapBuildLayerId,
): 'harbours' | 'anchorages' | 'places' | 'seamarks' | null {
  if (layerId === 'osm-harbours') return 'harbours'
  if (layerId === 'osm-anchorage') return 'anchorages'
  if (layerId === 'osm-places') return 'places'
  if (layerId === 'osm-seamarks') return 'seamarks'
  return null
}
