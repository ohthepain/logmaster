import type { Route, RouteWaypoint } from '../domain/route'
import { escapeGpxXml } from './gpx-export'
import { sortRouteWaypoints } from './route-map-geo'

function formatRouteWaypointBlock(
  waypoint: RouteWaypoint,
  index: number,
  tag: 'rtept' | 'wpt',
): string {
  const name = waypoint.name?.trim() || `Waypoint ${index + 1}`
  const lines = [
    `  <${tag} lat="${waypoint.latitude.toFixed(7)}" lon="${waypoint.longitude.toFixed(7)}">`,
    `    <name>${escapeGpxXml(name)}</name>`,
  ]
  if (waypoint.description?.trim()) {
    lines.push(`    <desc>${escapeGpxXml(waypoint.description.trim())}</desc>`)
  }
  if (waypoint.symbol?.trim()) {
    lines.push(`    <sym>${escapeGpxXml(waypoint.symbol.trim())}</sym>`)
  }
  lines.push(`  </${tag}>`)
  return lines.join('\n')
}

export function buildRouteGpx(route: Route, waypoints: RouteWaypoint[]): string {
  const ordered = sortRouteWaypoints(waypoints)
  if (ordered.length === 0) {
    throw new Error('This route has no waypoints to export.')
  }

  const name = route.title.trim() || 'Route'
  const exportedAt = route.updatedAt || new Date().toISOString()
  const rtePoints = ordered
    .map((waypoint, index) => formatRouteWaypointBlock(waypoint, index, 'rtept'))
    .join('\n')
  const wptPoints = ordered
    .map((waypoint, index) => formatRouteWaypointBlock(waypoint, index, 'wpt'))
    .join('\n')

  const descriptionLine = route.description?.trim()
    ? `    <desc>${escapeGpxXml(route.description.trim())}</desc>\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="logmaster" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeGpxXml(name)}</name>
    <time>${exportedAt}</time>
  </metadata>
  <rte>
    <name>${escapeGpxXml(name)}</name>
${descriptionLine}${rtePoints}
  </rte>
${wptPoints}
</gpx>
`

}
