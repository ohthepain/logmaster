import type { OsmPointDatasetId } from '../../lib/map-data-layers'
import type { GridCell } from '../marinas/grid'
import {
  fetchOverpassElementsForCells,
  formatMarinaCellLogLine
  
  
  
} from '../marinas/overpass'
import type {FetchMarinasOptions, MarinaCellResult, OverpassElement} from '../marinas/overpass';
import { kindForTags, overpassQueryForCell } from './queries'
import {
  mergeOsmPointFeatures
} from './schema'
import type {OsmPointFeature} from './schema';
import { formatOsmDepthLabel } from '../../lib/osm-feature-display'

function defaultKindForDataset(dataset: OsmPointDatasetId): string {
  if (dataset === 'harbours') return 'harbour'
  if (dataset === 'anchorages') return 'anchorage'
  return 'other'
}

function featureName(tags: Record<string, string>): string | null {
  const name =
    tags.name?.trim() ||
    tags['seamark:name']?.trim() ||
    tags['alt_name']?.trim()
  return name || null
}

export function overpassElementToOsmPoint(
  dataset: OsmPointDatasetId,
  element: OverpassElement,
  defaultKind: string,
): OsmPointFeature | null {
  if (
    element.type !== 'node' &&
    element.type !== 'way' &&
    element.type !== 'relation'
  ) {
    return null
  }
  const lat = element.lat ?? element.center?.lat ?? null
  const lon = element.lon ?? element.center?.lon ?? null
  if (
    lat == null ||
    lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null
  }
  const tags = element.tags ?? {}
  const kind = kindForTags(dataset, tags, defaultKind)
  const depthLabel = kind === 'depth' ? formatOsmDepthLabel(tags) : null
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id: `osm:${element.type}/${element.id}`,
      osmType: element.type,
      osmId: element.id,
      name: featureName(tags) ?? depthLabel,
      kind,
      tags,
      sources: ['osm'],
      ...(depthLabel ? { depthLabel } : {}),
    },
  }
}

function elementsToFeatures(
  dataset: OsmPointDatasetId,
  elements: OverpassElement[],
): OsmPointFeature[] {
  const defaultKind = defaultKindForDataset(dataset)
  const features: OsmPointFeature[] = []
  for (const element of elements) {
    const feature = overpassElementToOsmPoint(dataset, element, defaultKind)
    if (feature) features.push(feature)
  }
  return features
}

export async function fetchOsmPointsForCells(
  dataset: OsmPointDatasetId,
  cells: GridCell[],
  options: FetchMarinasOptions = {},
): Promise<OsmPointFeature[]> {
  const elements = await fetchOverpassElementsForCells(
    cells,
    (cell) => overpassQueryForCell(dataset, cell),
    options,
  )
  return mergeOsmPointFeatures(elementsToFeatures(dataset, elements))
}

export function formatOsmPointCellLogLine(
  dataset: OsmPointDatasetId,
  result: MarinaCellResult,
): string {
  return formatMarinaCellLogLine(result).replace('[marinas]', `[${dataset}]`)
}
