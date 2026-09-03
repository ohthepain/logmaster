import type { GridCell } from '../marinas/grid'
import type { OsmPointDatasetId } from '../../lib/map-data-layers'

type QueryPart = { kind: string; ql: string }

function cellBbox(cell: GridCell): string {
  const { south, west, north, east } = cell
  return `${south},${west},${north},${east}`
}

function partsForDataset(dataset: OsmPointDatasetId): QueryPart[] {
  switch (dataset) {
    case 'harbours':
      return [
        { kind: 'harbour', ql: 'nwr["seamark:type"="harbour"]' },
        { kind: 'harbour', ql: 'nwr["harbour"]' },
      ]
    case 'anchorages':
      return [{ kind: 'anchorage', ql: 'nwr["seamark:type"="anchorage"]' }]
    case 'places':
      return [
        { kind: 'bay', ql: 'nwr["natural"="bay"]' },
        { kind: 'cape', ql: 'nwr["natural"="cape"]' },
        { kind: 'island', ql: 'nwr["place"="island"]' },
        { kind: 'islet', ql: 'nwr["place"="islet"]' },
        { kind: 'strait', ql: 'nwr["natural"="strait"]' },
      ]
    case 'seamarks':
      return [
        {
          kind: 'seamark',
          ql: 'nwr["seamark:type"~"^(buoy|beacon|light_major|light_minor|notice|restricted_area|wreck)$"]',
        },
        { kind: 'depth', ql: 'node["seamark:type"="depth"]' },
        { kind: 'depth', ql: 'node["seamark:sounding:value"]' },
        { kind: 'depth', ql: 'node["depth"]["seamark:type"]' },
        { kind: 'wreck', ql: 'nwr["historic"="wreck"]' },
      ]
    default:
      throw new Error(`Dataset "${dataset}" has no Overpass query in osm-points`)
  }
}

export function overpassQueryForCell(
  dataset: OsmPointDatasetId,
  cell: GridCell,
): string {
  const bbox = cellBbox(cell)
  const parts = partsForDataset(dataset)
  const body = parts.map(({ ql }) => `  ${ql}(${bbox});`).join('\n')
  return `[out:json][timeout:120];
(
${body}
);
out center tags;`
}

export function kindForTags(
  dataset: OsmPointDatasetId,
  tags: Record<string, string>,
  defaultKind: string,
): string {
  if (dataset === 'seamarks') {
    const seamarkType = tags['seamark:type']
    if (seamarkType === 'buoy' || seamarkType === 'beacon') return seamarkType
    if (seamarkType === 'light_major' || seamarkType === 'light_minor') {
      return 'light'
    }
    if (seamarkType === 'notice') return 'notice'
    if (seamarkType === 'restricted_area') return 'restricted'
    if (seamarkType === 'depth') return 'depth'
    if (tags['seamark:sounding:value']?.trim()) return 'depth'
    if (seamarkType === 'wreck' || tags.historic === 'wreck') return 'wreck'
    return 'other'
  }
  if (dataset === 'places') {
    if (tags.natural === 'bay') return 'bay'
    if (tags.natural === 'cape') return 'cape'
    if (tags.place === 'island') return 'island'
    if (tags.place === 'islet') return 'islet'
    if (tags.natural === 'strait') return 'strait'
  }
  return defaultKind
}
