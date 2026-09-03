import type { FeatureCollection, Point } from 'geojson'
import type maplibregl from 'maplibre-gl'
import { degreeTilesForBbox,
  appGeoFeatureTileUrl,
  isGeoFeatureCollection,
  mergeGeoFeatureCollections
  
 } from './geo-feature-tiles'
import type {GeoFeatureCollection} from './geo-feature-tiles';
import {
  MAP_DATA_LAYERS,
  isRasterMapDataLayerId,
  mapDataLayerAuxiliaryLayerId,
  mapDataLayerCircleLayerId,
  mapDataLayerRenderLayerId,
  mapDataLayerSymbolLayerId,
} from './map-data-layers'
import type {MapDataLayerDefinition, MapDataLayerId, MapDataLayerToggles, OsmPointDatasetId} from './map-data-layers';
import {
  hazardIconImageExpression,
  hazardIconSizeExpression,
  installMapHazardIcons,
} from './map-hazard-icons'
import {
  enrichOsmPointProperties,
  parseOsmFeatureTags,
} from './osm-feature-display'
import { appOsmPointTileUrl  } from './osm-point-tiles'
import type {OsmPointProperties} from './osm-point-tiles';
import {
  OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
  OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID,
} from './maplibre-openseamap-bathymetry'
import {
  OPEN_SEAMAP_SEAMARK_LAYER_ID,
  OPEN_SEAMAP_SEAMARK_SOURCE_ID,
} from './maplibre-openseamap'
import { getGeoJsonSource } from './maplibre-source'

type OsmPointFeatureCollection = FeatureCollection<Point, OsmPointProperties>

function emptyCollection(): OsmPointFeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function datasetSourceId(dataset: OsmPointDatasetId): string {
  return `geo-dataset-${dataset}`
}

function geoSourceId(resolution: 'highres' | 'lowres'): string {
  return `geo-geonames-${resolution}`
}

function isOsmPointCollection(value: unknown): value is OsmPointFeatureCollection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { type?: unknown; features?: unknown }
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

function mergeOsmCollections(
  collections: OsmPointFeatureCollection[],
): OsmPointFeatureCollection {
  const byId = new Map<string, OsmPointFeatureCollection['features'][number]>()
  for (const collection of collections) {
    for (const feature of collection.features) {
      byId.set(feature.properties.id, {
        ...feature,
        properties: enrichOsmPointProperties(
          feature.properties,
        ) as unknown as OsmPointProperties,
      })
    }
  }
  return {
    type: 'FeatureCollection',
    features: Array.from(byId.values()),
  }
}

function circlePaintForLayer(
  layer: MapDataLayerDefinition,
): maplibregl.CircleLayerSpecification['paint'] {
  const base = {
    'circle-radius': circleRadiusForLayer(layer),
    'circle-opacity': layer.id === 'osm-seamarks-lights' ? 0.95 : 0.9,
    'circle-stroke-width': layer.group === 'navigation' ? 1.5 : 1,
  }

  if (layer.id === 'osm-seamarks-lights') {
    return {
      ...base,
      'circle-color': [
        'coalesce',
        ['get', 'markerColor'],
        layer.circleColor,
      ] as maplibregl.ExpressionSpecification,
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'markerColor'], '#f8fafc'],
        '#475569',
        '#0f172a',
      ] as maplibregl.ExpressionSpecification,
    }
  }

  return {
    ...base,
    'circle-color': layer.circleColor,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#0f172a',
  }
}

function kindFilterExpression(kinds: string[]) {
  if (kinds.length === 1) {
    return ['==', ['get', 'kind'], kinds[0]] as maplibregl.FilterSpecification
  }
  return [
    'any',
    ...kinds.map((kind) => ['==', ['get', 'kind'], kind]),
  ] as maplibregl.FilterSpecification
}

const RASTER_TOGGLE_LAYER_IDS: Partial<Record<MapDataLayerId, string>> = {
  'openseamap-raster': OPEN_SEAMAP_SEAMARK_LAYER_ID,
  'openseamap-bathymetry-relief': OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID,
  'openseamap-bathymetry-contours': OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
}

function moveLayerBeforeIfExists(
  map: maplibregl.Map,
  layerId: string,
  beforeId: string,
) {
  if (!map.getLayer(layerId) || !map.getLayer(beforeId)) return
  try {
    map.moveLayer(layerId, beforeId)
  } catch {
    /* ignore */
  }
}
const APP_MAP_OVERLAY_LAYER_IDS = [
  'trip-log-track-line',
  'trip-log-entry-circles',
  'trip-log-entry-icons',
  'trip-current-position-halo',
  'trip-current-position-dot',
  'compose-log-track-line',
  'compose-log-entry-circles',
  'compose-log-entry-icons',
] as const

const MAP_FEATURE_QUERY_PAD_PX = 16

function circleRadiusForLayer(layer: MapDataLayerDefinition) {
  if (layer.group !== 'navigation') return layer.circleRadius
  const base = layer.circleRadius
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    8,
    base,
    14,
    base + 2,
    18,
    base + 4,
  ] as maplibregl.ExpressionSpecification
}

export function visibleMapDataLayerIds(
  map: maplibregl.Map,
  toggles?: MapDataLayerToggles,
): string[] {
  return MAP_DATA_LAYERS.filter((layer) => {
    if (isRasterMapDataLayerId(layer.id)) return false
    if (toggles && !toggles[layer.id]) return false
    const layerId = mapDataLayerRenderLayerId(layer.id)
    if (!map.getLayer(layerId)) return false
    return map.getLayoutProperty(layerId, 'visibility') !== 'none'
  }).map((layer) => mapDataLayerRenderLayerId(layer.id))
}

export function queryTappableMapDataFeatures(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
  toggles?: MapDataLayerToggles,
): maplibregl.MapGeoJSONFeature[] {
  const layerIds = visibleMapDataLayerIds(map, toggles)
  if (layerIds.length === 0) return []

  const x = typeof point === 'object' && 'x' in point ? point.x : 0
  const y = typeof point === 'object' && 'y' in point ? point.y : 0
  const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
    [x - MAP_FEATURE_QUERY_PAD_PX, y - MAP_FEATURE_QUERY_PAD_PX],
    [x + MAP_FEATURE_QUERY_PAD_PX, y + MAP_FEATURE_QUERY_PAD_PX],
  ]

  const hits = map.queryRenderedFeatures(bbox, { layers: layerIds })
  if (hits.length <= 1) return hits

  return [...hits].sort((a, b) => {
    const geometryA = a.geometry
    const geometryB = b.geometry
    if (geometryA.type !== 'Point' || geometryB.type !== 'Point') return 0
    const [lngA, latA] = geometryA.coordinates
    const [lngB, latB] = geometryB.coordinates
    const projectedA = map.project([lngA, latA])
    const projectedB = map.project([lngB, latB])
    const distA = (projectedA.x - x) ** 2 + (projectedA.y - y) ** 2
    const distB = (projectedB.x - x) ** 2 + (projectedB.y - y) ** 2
    return distA - distB
  })
}

/** Raster overlays below vector layers; trip/compose graphics stay on top. */
export function ensureMapDataLayerStackOrder(map: maplibregl.Map) {
  const geoLayerIds = MAP_DATA_LAYERS.filter(
    (layer) => !isRasterMapDataLayerId(layer.id),
  )
    .map((layer) => mapDataLayerRenderLayerId(layer.id))
    .filter((id) => map.getLayer(id))

  for (const layerId of geoLayerIds) {
    try {
      map.moveLayer(layerId)
    } catch {
      /* ignore */
    }
  }

  const anchor = geoLayerIds[0] ?? null
  if (anchor) {
    moveLayerBeforeIfExists(map, OPEN_SEAMAP_SEAMARK_LAYER_ID, anchor)
  }

  const seamarkOrAnchor = map.getLayer(OPEN_SEAMAP_SEAMARK_LAYER_ID)
    ? OPEN_SEAMAP_SEAMARK_LAYER_ID
    : anchor
  if (seamarkOrAnchor) {
    moveLayerBeforeIfExists(
      map,
      OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
      seamarkOrAnchor,
    )
  }

  const topBathymetryRaster = [
    OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID,
    OPEN_SEAMAP_BATHYMETRY_CONTOURS_LAYER_ID,
  ]
    .filter((id) => map.getLayer(id))
    .at(-1)
  const contoursOrSeamarkOrAnchor = topBathymetryRaster ?? seamarkOrAnchor
  if (contoursOrSeamarkOrAnchor) {
    moveLayerBeforeIfExists(
      map,
      OPEN_SEAMAP_BATHYMETRY_RELIEF_LAYER_ID,
      contoursOrSeamarkOrAnchor,
    )
  }

  for (const layerId of APP_MAP_OVERLAY_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue
    try {
      map.moveLayer(layerId)
    } catch {
      /* ignore */
    }
  }
}

function ensureDatasetSource(map: maplibregl.Map, dataset: OsmPointDatasetId) {
  const sourceId = datasetSourceId(dataset)
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: emptyCollection() })
  }
}

function ensureGeoSource(map: maplibregl.Map, resolution: 'highres' | 'lowres') {
  const sourceId = geoSourceId(resolution)
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: emptyCollection() })
  }
}

function ensureHazardSymbolLayer(map: maplibregl.Map, layer: MapDataLayerDefinition) {
  const layerId = mapDataLayerRenderLayerId(layer.id)
  if (map.getLayer(layerId)) return
  if (!layer.dataset || !layer.kindFilter) return

  installMapHazardIcons(map)
  ensureDatasetSource(map, layer.dataset)
  map.addLayer({
    id: layerId,
    type: 'symbol',
    source: datasetSourceId(layer.dataset),
    filter: kindFilterExpression(layer.kindFilter),
    layout: {
      visibility: 'none',
      'icon-image': hazardIconImageExpression(),
      'icon-size': hazardIconSizeExpression(),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })
}

function defaultMapTextFont(map: maplibregl.Map): string[] {
  const layers = map.getStyle().layers ?? []
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const textFont = layer.layout?.['text-font']
    if (Array.isArray(textFont) && textFont.every((entry) => typeof entry === 'string')) {
      return textFont as string[]
    }
  }
  return ['Roboto Regular', 'Arial Unicode MS Regular']
}

const depthLabelFilter = [
  'all',
  ['has', 'depthLabel'],
  ['!=', ['get', 'depthLabel'], ''],
] as maplibregl.FilterSpecification

function ensureDepthSoundingLayers(map: maplibregl.Map, layer: MapDataLayerDefinition) {
  if (!layer.dataset || !layer.kindFilter) return

  const circleLayerId = mapDataLayerCircleLayerId(layer.id)
  const symbolLayerId = mapDataLayerSymbolLayerId(layer.id)
  ensureDatasetSource(map, layer.dataset)
  const sourceId = datasetSourceId(layer.dataset)
  const kindFilter = kindFilterExpression(layer.kindFilter)
  const labelFilter = [
    'all',
    kindFilter,
    depthLabelFilter,
  ] as maplibregl.FilterSpecification

  if (!map.getLayer(circleLayerId)) {
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      filter: labelFilter,
      paint: {
        'circle-radius': 5,
        'circle-color': layer.circleColor,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#0f172a',
      },
      layout: { visibility: 'none' },
    })
  }

  if (!map.getLayer(symbolLayerId)) {
    map.addLayer({
      id: symbolLayerId,
      type: 'symbol',
      source: sourceId,
      filter: labelFilter,
      layout: {
        visibility: 'none',
        'text-field': ['get', 'depthLabel'],
        'text-size': 11,
        'text-font': defaultMapTextFont(map),
        'text-offset': [0, -1.1],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#e0f2fe',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.2,
      },
    })
  }
}

function ensureDataLayerCircle(map: maplibregl.Map, layer: MapDataLayerDefinition) {
  if (layer.id === 'osm-seamarks-other') {
    ensureHazardSymbolLayer(map, layer)
    return
  }
  if (layer.id === 'osm-depth-soundings') {
    ensureDepthSoundingLayers(map, layer)
    return
  }

  const layerId = mapDataLayerCircleLayerId(layer.id)
  if (map.getLayer(layerId)) return

  if (layer.geoFeatureResolution) {
    ensureGeoSource(map, layer.geoFeatureResolution)
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: geoSourceId(layer.geoFeatureResolution),
      paint: {
        'circle-radius': layer.circleRadius,
        'circle-color': layer.circleColor,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#0f172a',
      },
      layout: { visibility: 'none' },
    })
    return
  }

  if (!layer.dataset) return
  ensureDatasetSource(map, layer.dataset)
  map.addLayer({
    id: layerId,
    type: 'circle',
    source: datasetSourceId(layer.dataset),
    filter: layer.kindFilter ? kindFilterExpression(layer.kindFilter) : undefined,
    paint: circlePaintForLayer(layer),
    layout: { visibility: 'none' },
  })
}

export function installMapDataLayers(map: maplibregl.Map) {
  for (const layer of MAP_DATA_LAYERS) {
    if (isRasterMapDataLayerId(layer.id)) continue
    ensureDataLayerCircle(map, layer)
  }
  ensureMapDataLayerStackOrder(map)
}

export function applyMapDataLayerToggles(
  map: maplibregl.Map,
  toggles: MapDataLayerToggles,
) {
  for (const [toggleId, layerId] of Object.entries(RASTER_TOGGLE_LAYER_IDS)) {
    if (!map.getLayer(layerId)) continue
    map.setLayoutProperty(
      layerId,
      'visibility',
      toggles[toggleId as MapDataLayerId] ? 'visible' : 'none',
    )
  }

  for (const layer of MAP_DATA_LAYERS) {
    if (isRasterMapDataLayerId(layer.id)) continue
    const layerId = mapDataLayerRenderLayerId(layer.id)
    if (!map.getLayer(layerId)) continue
    map.setLayoutProperty(
      layerId,
      'visibility',
      toggles[layer.id] ? 'visible' : 'none',
    )
    const auxiliaryLayerId = mapDataLayerAuxiliaryLayerId(layer.id)
    if (auxiliaryLayerId && map.getLayer(auxiliaryLayerId)) {
      map.setLayoutProperty(
        auxiliaryLayerId,
        'visibility',
        toggles[layer.id] ? 'visible' : 'none',
      )
    }
  }
}

async function fetchJsonTile(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function refreshMapDataLayersForViewport(
  map: maplibregl.Map,
  toggles: MapDataLayerToggles,
) {
  const bounds = map.getBounds()
  const tiles = degreeTilesForBbox([
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ])

  const datasetsNeeded = new Set<OsmPointDatasetId>()
  let geoResolution: 'highres' | 'lowres' | null = null

  for (const layer of MAP_DATA_LAYERS) {
    if (!toggles[layer.id]) continue
    if (layer.dataset) datasetsNeeded.add(layer.dataset)
    if (layer.geoFeatureResolution) geoResolution = layer.geoFeatureResolution
  }

  await Promise.all(
    Array.from(datasetsNeeded).map(async (dataset) => {
      const collections: OsmPointFeatureCollection[] = []
      for (const tile of tiles) {
        const payload = await fetchJsonTile(appOsmPointTileUrl(dataset, tile))
        if (isOsmPointCollection(payload)) collections.push(payload)
      }
      const source = getGeoJsonSource(map, datasetSourceId(dataset))
      source?.setData(mergeOsmCollections(collections))
    }),
  )

  ensureMapDataLayerStackOrder(map)

  if (geoResolution && toggles['geonames-cities']) {
    const collections: GeoFeatureCollection[] = []
    for (const tile of tiles) {
      const payload = await fetchJsonTile(appGeoFeatureTileUrl(tile, geoResolution))
      if (isGeoFeatureCollection(payload)) collections.push(payload)
    }
    const source = getGeoJsonSource(map, geoSourceId(geoResolution))
    source?.setData(mergeGeoFeatureCollections(collections))
  }
}

export type MapDataFeaturePopup = {
  layerId: MapDataLayerId
  name: string | null
  kind: string | null
  tags: Record<string, string>
  osmType: string | null
  osmId: number | null
  coordinates: [number, number]
}

function parseFeatureOsmId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return null
}

export function bindMapDataLayerPopups(
  map: maplibregl.Map,
  onSelect: (feature: MapDataFeaturePopup) => void,
  getToggles?: () => MapDataLayerToggles,
) {
  const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
    const hits = queryTappableMapDataFeatures(map, event.point, getToggles?.())
    map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : ''
  }

  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = ''
  }

  const handler = (event: maplibregl.MapMouseEvent) => {
    const hits = queryTappableMapDataFeatures(map, event.point, getToggles?.())
    const hit = hits[0]
    if (!hit?.layer?.id || !hit.properties) return

    const layerDef = MAP_DATA_LAYERS.find(
      (l) => mapDataLayerRenderLayerId(l.id) === hit.layer?.id,
    )
    if (!layerDef) return

    const props = hit.properties
    const tags = parseOsmFeatureTags(props.tags)

    onSelect({
      layerId: layerDef.id,
      name: typeof props.name === 'string' ? props.name : null,
      kind: typeof props.kind === 'string' ? props.kind : null,
      tags,
      osmType: typeof props.osmType === 'string' ? props.osmType : null,
      osmId: parseFeatureOsmId(props.osmId),
      coordinates: [event.lngLat.lng, event.lngLat.lat],
    })
  }

  map.on('mousemove', handleMouseMove)
  map.on('mouseleave', handleMouseLeave)
  map.on('click', handler)
  return () => {
    map.off('mousemove', handleMouseMove)
    map.off('mouseleave', handleMouseLeave)
    map.off('click', handler)
    map.getCanvas().style.cursor = ''
  }
}

export function scheduleMapDataLayerRefresh(
  map: maplibregl.Map,
  toggles: MapDataLayerToggles,
) {
  map.once('idle', () => {
    void refreshMapDataLayersForViewport(map, toggles)
  })
}

export function bindMapDataLayerRefreshOnViewChange(
  map: maplibregl.Map,
  getToggles: () => MapDataLayerToggles,
) {
  const refresh = () => scheduleMapDataLayerRefresh(map, getToggles())
  map.on('zoomend', refresh)
  map.on('moveend', refresh)
  return () => {
    map.off('zoomend', refresh)
    map.off('moveend', refresh)
  }
}

export function setOpenSeaMapOverlayVisible(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer(OPEN_SEAMAP_SEAMARK_LAYER_ID)) return
  map.setLayoutProperty(
    OPEN_SEAMAP_SEAMARK_LAYER_ID,
    'visibility',
    visible ? 'visible' : 'none',
  )
}

export { OPEN_SEAMAP_SEAMARK_LAYER_ID, OPEN_SEAMAP_SEAMARK_SOURCE_ID }
