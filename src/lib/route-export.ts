import type { Route, RouteWaypoint } from '../domain/route'
import { saveTextExport, sanitizeExportFileName } from './export-file'
import { buildRouteGpx } from './gpx-route-export'
import { buildRouteSignalKExport } from './signalk-route-export'

export async function exportRouteAsGpx(
  route: Route,
  waypoints: RouteWaypoint[],
): Promise<void> {
  const gpx = buildRouteGpx(route, waypoints)
  const fileName = sanitizeExportFileName(route.title.trim() || 'route', 'gpx')
  await saveTextExport(fileName, gpx, 'application/gpx+xml')
}

export async function exportRouteAsSignalK(
  route: Route,
  waypoints: RouteWaypoint[],
): Promise<void> {
  const json = buildRouteSignalKExport(route, waypoints)
  const fileName = sanitizeExportFileName(
    `${route.title.trim() || 'route'} signalk`,
    'json',
  )
  await saveTextExport(fileName, json, 'application/json')
}
