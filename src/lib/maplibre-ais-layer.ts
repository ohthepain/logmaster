import type { FeatureCollection, Point } from 'geojson'
import type maplibregl from 'maplibre-gl'
import type { AisVesselCategory } from '../domain/ais-vessel-categories'
import {
  AIS_VESSEL_CATEGORY_COLORS,
  AIS_VESSEL_CATEGORY_LABELS,
  AIS_VESSEL_CATEGORY_ORDER,
  aisVesselIconId,
} from '../domain/ais-vessel-categories'
import { escapeHtml } from './osm-feature-display'

export const AIS_VESSELS_SOURCE_ID = 'ais-vessels'
export const AIS_VESSELS_LAYER_ID = 'ais-vessel-symbols'

const AIS_ICON_SIZE = 44

function emptyCollection(): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: [] }
}

function createAisTriangleImageData(fillColor: string): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = AIS_ICON_SIZE
  canvas.height = AIS_ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create AIS marker canvas')

  ctx.clearRect(0, 0, AIS_ICON_SIZE, AIS_ICON_SIZE)
  ctx.fillStyle = fillColor
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2.25
  ctx.beginPath()
  ctx.moveTo(AIS_ICON_SIZE / 2, 3)
  ctx.lineTo(AIS_ICON_SIZE - 5, AIS_ICON_SIZE - 5)
  ctx.lineTo(5, AIS_ICON_SIZE - 5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  return ctx.getImageData(0, 0, AIS_ICON_SIZE, AIS_ICON_SIZE)
}

export function ensureAisVesselMapIcons(map: maplibregl.Map) {
  for (const category of AIS_VESSEL_CATEGORY_ORDER) {
    const iconId = aisVesselIconId(category)
    if (map.hasImage(iconId)) continue
    map.addImage(iconId, createAisTriangleImageData(AIS_VESSEL_CATEGORY_COLORS[category]), {
      pixelRatio: 2,
    })
  }
}

function aisIconImageExpression() {
  return [
    'match',
    ['get', 'category'],
    'cargo',
    aisVesselIconId('cargo'),
    'tanker',
    aisVesselIconId('tanker'),
    'passenger',
    aisVesselIconId('passenger'),
    'hsc',
    aisVesselIconId('hsc'),
    'tug_special',
    aisVesselIconId('tug_special'),
    'fishing',
    aisVesselIconId('fishing'),
    'pleasure',
    aisVesselIconId('pleasure'),
    aisVesselIconId('unspecified'),
  ] as maplibregl.ExpressionSpecification
}

export function installAisMapLayer(map: maplibregl.Map) {
  if (!map.getSource(AIS_VESSELS_SOURCE_ID)) {
    map.addSource(AIS_VESSELS_SOURCE_ID, {
      type: 'geojson',
      data: emptyCollection(),
    })
  }

  ensureAisVesselMapIcons(map)

  if (!map.getLayer(AIS_VESSELS_LAYER_ID)) {
    map.addLayer({
      id: AIS_VESSELS_LAYER_ID,
      type: 'symbol',
      source: AIS_VESSELS_SOURCE_ID,
      layout: {
        'icon-image': aisIconImageExpression(),
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          0.85,
          14,
          1.2,
          18,
          1.55,
        ],
        'icon-rotate': [
          'coalesce',
          ['get', 'heading'],
          ['get', 'cog'],
          0,
        ],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['coalesce', ['get', 'name'], ['get', 'mmsi']],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-offset': [0, 1.35],
        'text-anchor': 'top',
        'text-optional': true,
        'text-max-width': 12,
      },
      paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': 'rgba(15, 23, 42, 0.85)',
        'text-halo-width': 1.2,
      },
    })
  }
}

export function setAisMapLayerVisibility(map: maplibregl.Map, visible: boolean) {
  if (!map.getLayer(AIS_VESSELS_LAYER_ID)) return
  map.setLayoutProperty(
    AIS_VESSELS_LAYER_ID,
    'visibility',
    visible ? 'visible' : 'none',
  )
}

export function updateAisMapLayerData(
  map: maplibregl.Map,
  collection: FeatureCollection<Point>,
) {
  const source = map.getSource(AIS_VESSELS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!source) return
  source.setData(collection)
}

export function clearAisMapLayerData(map: maplibregl.Map) {
  updateAisMapLayerData(map, emptyCollection())
}

export type AisVesselPopup = {
  mmsi: string
  name: string | null
  sog: number | null
  cog: number | null
  heading: number | null
  coordinates: [number, number]
  category: AisVesselCategory | null
  shipTypeLabel: string | null
  navigationalStatusLabel: string | null
  destination: string | null
  callSign: string | null
  imo: string | null
  lengthMeters: number | null
  widthMeters: number | null
  updatedAt: string | null
}

export type AisVesselPopupDetails = {
  photoUrl?: string | null
  categoryColor?: string | null
  categoryLabel?: string | null
  links?: {
    marineTraffic?: string
    vesselFinder?: string
  }
}

function readFeatureString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function readFeatureNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function aisVesselPopupFromFeatureProperties(
  props: Record<string, unknown>,
  coordinates: [number, number],
): AisVesselPopup {
  const category = readFeatureString(props.category)
  return {
    mmsi: readFeatureString(props.mmsi) ?? '',
    name: readFeatureString(props.name),
    sog: readFeatureNumber(props.sog),
    cog: readFeatureNumber(props.cog),
    heading: readFeatureNumber(props.heading),
    coordinates,
    category:
      category && category in AIS_VESSEL_CATEGORY_COLORS
        ? (category as AisVesselCategory)
        : null,
    shipTypeLabel: readFeatureString(props.shipTypeLabel),
    navigationalStatusLabel: readFeatureString(props.navigationalStatusLabel),
    destination: readFeatureString(props.destination),
    callSign: readFeatureString(props.callSign),
    imo: readFeatureString(props.imo),
    lengthMeters: readFeatureNumber(props.lengthMeters),
    widthMeters: readFeatureNumber(props.widthMeters),
    updatedAt: readFeatureString(props.updatedAt),
  }
}

function formatKnots(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)} kn`
}

function formatDegrees(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}°`
}

function formatMeters(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value)} m`
}

function formatUpdatedAt(value: string | null) {
  if (!value) return '—'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(parsed))
}

const POPUP_LINK_STYLE =
  'display:block;font-size:0.72rem;font-weight:600;color:#7ec8e8;text-decoration:none'

function popupRow(label: string, value: string) {
  return `<div style="display:flex;gap:0.5rem;margin-top:0.35rem;line-height:1.35">
    <span style="flex:0 0 auto;min-width:4.75rem;font-size:0.68rem;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.5)">${escapeHtml(label)}</span>
    <span style="flex:1;font-size:0.78rem;color:rgba(255,255,255,0.92)">${value}</span>
  </div>`
}

export function formatAisVesselPopupHtml(
  vessel: AisVesselPopup,
  details?: AisVesselPopupDetails,
  options?: { loading?: boolean },
) {
  const title = vessel.name?.trim() || `MMSI ${vessel.mmsi}`
  const categoryLabel =
    details?.categoryLabel ??
    (vessel.category ? AIS_VESSEL_CATEGORY_LABELS[vessel.category] : null)
  const categoryColor =
    details?.categoryColor ??
    (vessel.category ? AIS_VESSEL_CATEGORY_COLORS[vessel.category] : '#9e9e9e')

  const badge = categoryLabel
    ? `<span class="ais-vessel-popup__badge" style="background:${categoryColor}">${escapeHtml(categoryLabel)}</span>`
    : ''

  const photoBlock = options?.loading
    ? `<div class="ais-vessel-popup__photo ais-vessel-popup__photo--loading">Loading photo…</div>`
    : details?.photoUrl
      ? `<img class="ais-vessel-popup__photo" src="${escapeHtml(details.photoUrl)}" alt="" loading="lazy" />`
      : ''

  const rows = [
    popupRow('MMSI', escapeHtml(vessel.mmsi)),
    vessel.imo ? popupRow('IMO', escapeHtml(vessel.imo)) : '',
    vessel.callSign ? popupRow('Call sign', escapeHtml(vessel.callSign)) : '',
    vessel.shipTypeLabel ? popupRow('AIS type', escapeHtml(vessel.shipTypeLabel)) : '',
    vessel.navigationalStatusLabel
      ? popupRow('Status', escapeHtml(vessel.navigationalStatusLabel))
      : '',
    popupRow('SOG', escapeHtml(formatKnots(vessel.sog))),
    popupRow('COG', escapeHtml(formatDegrees(vessel.cog))),
    popupRow('Heading', escapeHtml(formatDegrees(vessel.heading))),
    vessel.destination ? popupRow('Destination', escapeHtml(vessel.destination)) : '',
    vessel.lengthMeters || vessel.widthMeters
      ? popupRow(
          'Size',
          escapeHtml(
            `${formatMeters(vessel.lengthMeters)} × ${formatMeters(vessel.widthMeters)}`,
          ),
        )
      : '',
    popupRow('Last report', escapeHtml(formatUpdatedAt(vessel.updatedAt))),
  ].join('')

  const links = [
    details?.links?.marineTraffic
      ? `<a href="${escapeHtml(details.links.marineTraffic)}" target="_blank" rel="noopener noreferrer" style="${POPUP_LINK_STYLE}">View on MarineTraffic</a>`
      : '',
    details?.links?.vesselFinder
      ? `<a href="${escapeHtml(details.links.vesselFinder)}" target="_blank" rel="noopener noreferrer" style="${POPUP_LINK_STYLE}">View on VesselFinder</a>`
      : '',
  ].filter(Boolean)

  const linksBlock =
    links.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:0.35rem;margin-top:0.65rem">${links.join('')}</div>`
      : ''

  return `<div class="ais-vessel-popup" style="font-family:system-ui,sans-serif;padding:0.05rem 0.05rem 0">
    ${photoBlock}
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-top:${photoBlock ? '0.55rem' : '0'}">
      <div style="font-size:0.88rem;font-weight:700;color:#fff;line-height:1.25">${escapeHtml(title)}</div>
      ${badge}
    </div>
    ${rows}
    ${linksBlock}
  </div>`
}

export function bindAisMapLayerPopups(
  map: maplibregl.Map,
  onSelect: (vessel: AisVesselPopup) => void,
) {
  const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
    const features = map.queryRenderedFeatures(event.point, {
      layers: [AIS_VESSELS_LAYER_ID],
    })
    map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
  }

  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = ''
  }

  const handleClick = (event: maplibregl.MapMouseEvent) => {
    const feature = map.queryRenderedFeatures(event.point, {
      layers: [AIS_VESSELS_LAYER_ID],
    })[0]
    if (!feature?.properties) return
    onSelect(
      aisVesselPopupFromFeatureProperties(
        feature.properties as Record<string, unknown>,
        [event.lngLat.lng, event.lngLat.lat],
      ),
    )
  }

  map.on('mousemove', handleMouseMove)
  map.on('mouseleave', handleMouseLeave)
  map.on('click', AIS_VESSELS_LAYER_ID, handleClick)

  return () => {
    map.off('mousemove', handleMouseMove)
    map.off('mouseleave', handleMouseLeave)
    map.off('click', AIS_VESSELS_LAYER_ID, handleClick)
    map.getCanvas().style.cursor = ''
  }
}
