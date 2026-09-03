import type { MapDataLayerId } from './map-data-layers'

export type MapFeaturePopupInput = {
  layerId: MapDataLayerId
  name: string | null
  kind: string | null
  tags: Record<string, string>
  osmType?: string | null
  osmId?: number | null
}

const OSM_COLOUR_HEX: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  white: '#f8fafc',
  yellow: '#fde047',
  amber: '#f59e0b',
  orange: '#f97316',
  blue: '#3b82f6',
  violet: '#a855f7',
  purple: '#a855f7',
  grey: '#94a3b8',
  gray: '#94a3b8',
  black: '#1e293b',
}

const LIGHT_FALLBACK_COLOR = '#fde047'

function normalizeColourToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function parseOsmFeatureTags(raw: unknown): Record<string, string> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
            typeof value === 'string' ? [[key, value]] : [],
          ),
        )
      }
    } catch {
      return {}
    }
    return {}
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === 'string' ? [[key, value]] : [],
      ),
    )
  }
  return {}
}

export function osmColourNameToHex(name: string): string | null {
  const token = normalizeColourToken(name)
  return OSM_COLOUR_HEX[token] ?? null
}

/** Primary chart colour for a navigation light (first listed sector/colour). */
export function osmLightDisplayColor(tags: Record<string, string>): string {
  for (const colour of osmLightColourNames(tags)) {
    const hex = osmColourNameToHex(colour)
    if (hex) return hex
  }
  const fallback =
    tags['seamark:colour'] ??
    tags.colour ??
    tags['seamark:buoy:colour'] ??
    tags['seamark:beacon:colour']
  if (fallback) {
    const hex = osmColourNameToHex(fallback.split(/[;,/|]/)[0] ?? fallback)
    if (hex) return hex
  }
  return LIGHT_FALLBACK_COLOR
}

export function osmLightColourNames(tags: Record<string, string>): string[] {
  const names: string[] = []
  const main = tags['seamark:light:colour']
  if (main) {
    for (const part of main.split(/[;,/|]/)) {
      const trimmed = part.trim()
      if (trimmed) names.push(trimmed)
    }
  }
  for (let index = 1; index <= 3; index += 1) {
    const sector = tags[`seamark:light:${index}:colour`]?.trim()
    if (sector) names.push(sector)
  }
  return [...new Set(names)]
}

export function formatOsmDepthLabel(tags: Record<string, string>): string | null {
  const raw =
    tags.depth?.trim() ||
    tags['seamark:depth']?.trim() ||
    tags['seamark:depth:depth']?.trim() ||
    tags['seamark:sounding:value']?.trim() ||
    null
  if (!raw) return null
  return /m$/i.test(raw) ? raw : `${raw} m`
}

export function enrichOsmPointProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const kind = typeof properties.kind === 'string' ? properties.kind : null
  const tags = parseOsmFeatureTags(properties.tags)
  if (kind === 'light') {
    return {
      ...properties,
      markerColor: osmLightDisplayColor(tags),
    }
  }
  if (kind === 'depth') {
    const depthLabel = formatOsmDepthLabel(tags)
    return {
      ...properties,
      depthLabel,
      name:
        typeof properties.name === 'string' && properties.name.trim().length > 0
          ? properties.name
          : depthLabel,
    }
  }
  return properties
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_:]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatSeamarkType(tags: Record<string, string>): string | null {
  const seamarkType = tags['seamark:type']
  if (!seamarkType) return null
  if (seamarkType === 'light_major') return 'Major light'
  if (seamarkType === 'light_minor') return 'Minor light'
  if (seamarkType === 'restricted_area') return 'Restricted area'
  if (seamarkType === 'depth') return 'Depth sounding'
  return humanizeToken(seamarkType)
}

function colourSwatchHtml(colourName: string): string {
  const hex = osmColourNameToHex(colourName) ?? '#64748b'
  const border = hex === '#f8fafc' ? '#64748b' : 'transparent'
  return `<span style="display:inline-block;width:0.65rem;height:0.65rem;border-radius:9999px;background:${hex};border:1px solid ${border};vertical-align:middle;margin-right:0.25rem"></span>`
}

function formatColourValue(value: string): string {
  const parts = value
    .split(/[;,/|]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return escapeHtml(value)
  return parts
    .map((part) => `${colourSwatchHtml(part)}${escapeHtml(part)}`)
    .join('<span style="opacity:0.45;margin:0 0.15rem">·</span>')
}

const LIGHT_COLOUR_ABBR: Record<string, string> = {
  white: 'W',
  red: 'R',
  green: 'G',
  yellow: 'Y',
  amber: 'Am',
  blue: 'Bu',
  violet: 'Vi',
  orange: 'Or',
  grey: 'Gr',
  gray: 'Gr',
}

const LIGHT_CATEGORY_ABBR: Record<string, string> = {
  vertical: 'vert',
  horizontal: 'hor',
  directional: 'dir',
  front: 'front',
  rear: 'rear',
  moire: 'moire',
}

function lightColourAbbreviation(value: string): string {
  return value
    .split(/[;,/|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => LIGHT_COLOUR_ABBR[part] ?? part.charAt(0).toUpperCase())
    .join('')
}

function formatLightSectorBearing(start?: string, end?: string): string | null {
  if (!start && !end) return null
  return `${start ?? '?'}°–${end ?? '?'}°`
}

function formatLightRangeSuffix(range: string): string {
  const trimmed = range.trim()
  const num = Number(trimmed)
  if (Number.isFinite(num) && Number.isInteger(num)) return `${num}M`
  return `${trimmed}M`
}

function formatLightPeriodSuffix(period: string): string {
  const trimmed = period.trim()
  return trimmed.endsWith('s') ? trimmed : `${trimmed}s`
}

/** Build one INT-1-style light characteristic, e.g. `2F.G(vert)2M` or `Fl(2).G 5s 2M`. */
export function formatLightCharacteristicFromBase(
  tags: Record<string, string>,
  base: string,
): string | null {
  const character = tags[`${base}:character`]?.trim()
  if (!character) return null

  let signal = ''
  const multiple = tags[`${base}:multiple`]?.trim()
  const group = tags[`${base}:group`]?.trim()

  if (multiple) {
    signal = `${multiple}${character}`
  } else if (group) {
    signal = `${character}(${group})`
  } else {
    signal = character
  }

  const colour = tags[`${base}:colour`]?.trim()
  if (colour) {
    signal += `.${lightColourAbbreviation(colour)}`
  }

  const category = tags[`${base}:category`]?.trim()
  if (category) {
    const abbr = LIGHT_CATEGORY_ABBR[category.toLowerCase()] ?? category
    signal += `(${abbr})`
  }

  const period = tags[`${base}:period`]?.trim()
  if (period) {
    signal += ` ${formatLightPeriodSuffix(period)}`
  }

  const range = tags[`${base}:range`]?.trim()
  if (range) {
    const rangeText = formatLightRangeSuffix(range)
    if (period) {
      signal += ` ${rangeText}`
    } else if (signal.endsWith(')')) {
      signal += rangeText
    } else {
      signal += ` ${rangeText}`
    }
  }

  const bearing = formatLightSectorBearing(
    tags[`${base}:sector_start`],
    tags[`${base}:sector_end`],
  )
  if (bearing) {
    signal += ` (${bearing})`
  }

  return signal.replace(/\s+/g, ' ').trim()
}

/** Chart characteristics for a light feature (one entry per sector when sectored). */
export function formatLightCharacteristics(tags: Record<string, string>): string[] {
  if (tags['seamark:light:1:character']) {
    const sectors: string[] = []
    for (let index = 1; index <= 8; index += 1) {
      const sector = formatLightCharacteristicFromBase(tags, `seamark:light:${index}`)
      if (sector) sectors.push(sector)
    }
    return sectors
  }

  const main = formatLightCharacteristicFromBase(tags, 'seamark:light')
  return main ? [main] : []
}

type PopupRow = { label: string; value: string; html?: boolean }

function rowsFromTags(
  tags: Record<string, string>,
  specs: Array<{ key: string; label: string; format?: 'colour' }>,
): PopupRow[] {
  const rows: PopupRow[] = []
  for (const spec of specs) {
    const raw = tags[spec.key]?.trim()
    if (!raw) continue
    rows.push({
      label: spec.label,
      value: spec.format === 'colour' ? formatColourValue(raw) : raw,
      html: spec.format === 'colour',
    })
  }
  return rows
}

function lightPopupRows(tags: Record<string, string>): PopupRow[] {
  const rows: PopupRow[] = []
  const typeLabel = formatSeamarkType(tags)
  if (typeLabel) rows.push({ label: 'Type', value: typeLabel })

  const characteristics = formatLightCharacteristics(tags)
  if (characteristics.length > 0) {
    rows.push({
      label: characteristics.length > 1 ? 'Characteristics' : 'Characteristic',
      value: characteristics.map((line) => escapeHtml(line)).join('<br />'),
      html: true,
    })
  }

  rows.push(
    ...rowsFromTags(tags, [
      { key: 'seamark:light:reference', label: 'Reference' },
      { key: 'seamark:light:height', label: 'Height (m)' },
      { key: 'seamark:light:sequence', label: 'Sequence' },
    ]),
  )

  if (characteristics.length > 0) {
    return rows
  }

  const colours = osmLightColourNames(tags)
  if (colours.length > 0) {
    rows.push({
      label: colours.length > 1 ? 'Colours' : 'Colour',
      value: colours
        .map((colour) => formatColourValue(colour))
        .join('<span style="opacity:0.45;margin:0 0.15rem">·</span>'),
      html: true,
    })
  }

  rows.push(
    ...rowsFromTags(tags, [
      { key: 'seamark:light:character', label: 'Character' },
      { key: 'seamark:light:sequence', label: 'Sequence' },
      { key: 'seamark:light:period', label: 'Period' },
      { key: 'seamark:light:range', label: 'Range (nm)' },
      { key: 'seamark:light:height', label: 'Height (m)' },
      { key: 'seamark:light:group', label: 'Group' },
      { key: 'seamark:light:reference', label: 'Reference' },
    ]),
  )

  for (let index = 1; index <= 3; index += 1) {
    const sector = tags[`seamark:light:${index}:sector_start`]
    const sectorEnd = tags[`seamark:light:${index}:sector_end`]
    const sectorColour = tags[`seamark:light:${index}:colour`]
    if (!sector && !sectorEnd && !sectorColour) continue
    const parts = [
      sectorColour ? formatColourValue(sectorColour) : null,
      sector || sectorEnd
        ? `${escapeHtml(sector ?? '?')}°–${escapeHtml(sectorEnd ?? '?')}°`
        : null,
    ].filter(Boolean)
    rows.push({
      label: `Sector ${index}`,
      value: parts.join(' · '),
      html: true,
    })
  }

  return rows
}

function hazardPopupRows(kind: string | null, tags: Record<string, string>): PopupRow[] {
  const rows: PopupRow[] = []
  const typeLabel = formatSeamarkType(tags) ?? (kind ? humanizeToken(kind) : null)
  if (typeLabel) rows.push({ label: 'Type', value: typeLabel })

  if (kind === 'wreck' || tags.historic === 'wreck') {
    rows.push(
      ...rowsFromTags(tags, [
        { key: 'seamark:wreck:category', label: 'Category' },
        { key: 'seamark:wreck:water_level', label: 'Water level' },
        { key: 'depth', label: 'Depth' },
        { key: 'seamark:depth', label: 'Charted depth' },
      ]),
    )
  }

  if (kind === 'restricted' || tags['seamark:type'] === 'restricted_area') {
    rows.push(
      ...rowsFromTags(tags, [
        { key: 'seamark:restriction', label: 'Restriction' },
        { key: 'seamark:restriction:category', label: 'Category' },
      ]),
    )
  }

  if (kind === 'notice' || tags['seamark:type'] === 'notice') {
    rows.push(
      ...rowsFromTags(tags, [
        { key: 'seamark:notice:function', label: 'Function' },
        { key: 'seamark:notice:information', label: 'Information' },
        { key: 'seamark:notice:category', label: 'Category' },
      ]),
    )
  }

  rows.push(
    ...rowsFromTags(tags, [
      { key: 'description', label: 'Description' },
      { key: 'note', label: 'Note' },
      { key: 'source', label: 'Source' },
    ]),
  )

  return rows
}

function buoyPopupRows(tags: Record<string, string>): PopupRow[] {
  const rows: PopupRow[] = []
  const typeLabel = formatSeamarkType(tags)
  if (typeLabel) rows.push({ label: 'Type', value: typeLabel })
  rows.push(
    ...rowsFromTags(tags, [
      { key: 'seamark:buoy:category', label: 'Category' },
      { key: 'seamark:buoy:shape', label: 'Shape' },
      { key: 'seamark:buoy:colour', label: 'Colour', format: 'colour' },
      { key: 'seamark:beacon:category', label: 'Category' },
      { key: 'seamark:beacon:shape', label: 'Shape' },
      { key: 'seamark:beacon:colour', label: 'Colour', format: 'colour' },
      { key: 'seamark:colour', label: 'Colour', format: 'colour' },
      { key: 'seamark:topmark:colour', label: 'Topmark' },
      { key: 'seamark:topmark:shape', label: 'Topmark shape' },
    ]),
  )
  return rows
}

function mooringPopupRows(tags: Record<string, string>): PopupRow[] {
  return rowsFromTags(tags, [
    { key: 'seamark:type', label: 'Type' },
    { key: 'leisure', label: 'Leisure' },
    { key: 'harbour', label: 'Harbour' },
    { key: 'seamark:anchorage:category', label: 'Category' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'website', label: 'Website' },
    { key: 'phone', label: 'Phone' },
    { key: 'description', label: 'Description' },
  ])
}

function placePopupRows(tags: Record<string, string>): PopupRow[] {
  return rowsFromTags(tags, [
    { key: 'natural', label: 'Natural' },
    { key: 'place', label: 'Place' },
    { key: 'description', label: 'Description' },
  ])
}

function depthPopupRows(tags: Record<string, string>): PopupRow[] {
  const rows: PopupRow[] = []
  const depthLabel = formatOsmDepthLabel(tags)
  if (depthLabel) rows.push({ label: 'Depth', value: depthLabel })
  rows.push(
    ...rowsFromTags(tags, [
      { key: 'seamark:depth:quality', label: 'Quality' },
      { key: 'seamark:depth:accuracy', label: 'Accuracy' },
      { key: 'source', label: 'Source' },
      { key: 'note', label: 'Note' },
    ]),
  )
  return rows
}

function popupRowsForFeature(input: MapFeaturePopupInput): PopupRow[] {
  const { layerId, kind, tags } = input
  if (layerId === 'osm-depth-soundings' || kind === 'depth') {
    return depthPopupRows(tags)
  }
  if (layerId === 'osm-seamarks-lights' || kind === 'light') {
    return lightPopupRows(tags)
  }
  if (layerId === 'osm-seamarks-other' || kind === 'wreck' || kind === 'restricted' || kind === 'notice') {
    return hazardPopupRows(kind, tags)
  }
  if (layerId === 'osm-seamarks-buoys' || kind === 'buoy' || kind === 'beacon') {
    return buoyPopupRows(tags)
  }
  if (layerId === 'osm-marinas' || layerId === 'osm-harbours' || layerId === 'osm-anchorage') {
    return mooringPopupRows(tags)
  }
  if (
    layerId === 'osm-bay' ||
    layerId === 'osm-cape' ||
    layerId === 'osm-island' ||
    layerId === 'osm-strait'
  ) {
    return placePopupRows(tags)
  }
  return rowsFromTags(tags, [
    { key: 'seamark:type', label: 'Type' },
    { key: 'description', label: 'Description' },
  ])
}

function popupTitle(input: MapFeaturePopupInput): string {
  if (input.name) return input.name
  const seamarkType = formatSeamarkType(input.tags)
  if (seamarkType) return seamarkType
  if (input.kind) return humanizeToken(input.kind)
  return 'Map feature'
}

function osmFeatureUrl(input: MapFeaturePopupInput): string | null {
  if (!input.osmType || input.osmId == null) return null
  return `https://www.openstreetmap.org/${input.osmType}/${input.osmId}`
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderPopupRow(row: PopupRow): string {
  const value = row.html ? row.value : escapeHtml(row.value)
  return `<div style="display:flex;gap:0.5rem;margin-top:0.35rem;line-height:1.35">
    <span style="flex:0 0 auto;min-width:4.75rem;font-size:0.68rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.5)">${escapeHtml(row.label)}</span>
    <span style="flex:1;font-size:0.78rem;color:rgba(255,255,255,0.92)">${value}</span>
  </div>`
}

export function formatMapFeaturePopupHtml(input: MapFeaturePopupInput): string {
  const title = popupTitle(input)
  const rows = popupRowsForFeature(input)
  const osmUrl = osmFeatureUrl(input)

  const rowHtml = rows.map(renderPopupRow).join('')
  const osmLink = osmUrl
    ? `<a href="${escapeHtml(osmUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:0.65rem;font-size:0.72rem;font-weight:600;color:#7ec8e8;text-decoration:none">View on OpenStreetMap</a>`
    : ''

  return `<div style="font-family:system-ui,sans-serif;padding:0.1rem 0.1rem 0.05rem">
    <div style="font-size:0.88rem;font-weight:700;color:#fff;line-height:1.25">${escapeHtml(title)}</div>
    ${rowHtml || '<div style="margin-top:0.35rem;font-size:0.78rem;color:rgba(255,255,255,0.55)">No extra details tagged.</div>'}
    ${osmLink}
  </div>`
}
