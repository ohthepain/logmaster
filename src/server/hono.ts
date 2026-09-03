import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  auth,
  getGoogleWebClientId,
  getTrustedOrigins,
  isGoogleSignInEnabled,
} from './auth'
import { getMapTilerApiKeyFromEnv } from '../lib/server-maptiler-key'
import { logbookRoutes } from './routes/logbook'
import { boatsRoutes } from './routes/boats'
import { profileRoutes } from './routes/profile'
import { crewRoutes } from './routes/crew'
import { locationRoutes } from './routes/location'
import { mapTileRoutes } from './routes/map-tiles'
import { mapStyleVectorRoutes } from './routes/map-style-vector'
import { maptileCdnRoutes } from './routes/maptile-cdn'
import { openseamapSeamarkRoutes } from './routes/openseamap-seamark'
import { openseamapBathymetryRoutes } from './routes/openseamap-bathymetry'
import { adminRoutes } from './routes/admin'
import { geoFeatureRoutes } from './routes/geo-features'
import { marinaRoutes } from './routes/marinas'
import { osmPointTileRoutes } from './routes/osm-point-tiles'
import { gpxImportRoutes } from './routes/gpx-import'

const corsOrigins = getTrustedOrigins()

export const app = new Hono({ strict: false }).basePath('/api')

app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Client-Version',
    ],
    exposeHeaders: ['Set-Cookie'],
    credentials: true,
  }),
)

app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'logmaster',
    ts: new Date().toISOString(),
    googleSignIn: isGoogleSignInEnabled(),
    googleWebClientId: getGoogleWebClientId(),
    mapTilerConfigured: Boolean(getMapTilerApiKeyFromEnv()),
  }),
)

app.route('/logbook', logbookRoutes)
app.route('/boats', boatsRoutes)
app.route('/profile', profileRoutes)
app.route('/crew', crewRoutes)
app.route('/location', locationRoutes)
app.route('/map-tiles', mapTileRoutes)
app.route('/map-style-vector', mapStyleVectorRoutes)
app.route('/maptiler-cdn', maptileCdnRoutes)
app.route('/openseamap-seamark', openseamapSeamarkRoutes)
app.route('/openseamap-bathymetry', openseamapBathymetryRoutes)
app.route('/admin', adminRoutes)
app.route('/geo-features', geoFeatureRoutes)
app.route('/marinas', marinaRoutes)
app.route('/osm-points', osmPointTileRoutes)
app.route('/gpx-import', gpxImportRoutes)
