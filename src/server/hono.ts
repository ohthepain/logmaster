import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ServerEnv } from './lib/hono-env'
import { requestLogMiddleware } from './middleware/request-log'
import {
  auth,
  getGoogleWebClientId,
  getTrustedOrigins,
  isGoogleSignInEnabled,
} from './auth'
import { getMapTilerApiKeyFromEnv } from '../lib/server-maptiler-key'
import { logbookStoryMediaRoutes } from './routes/logbook-story-media'
import { logbookRoutes } from './routes/logbook'
import { logbookTrackRoutes } from './routes/logbook-tracks'
import { boatsRoutes } from './routes/boats'
import { boatSharesRoutes } from './routes/boat-shares'
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
import { placesRoutes } from './routes/places'
import { aisRoutes } from './routes/ais'
import { routesApi } from './routes/routes'
import { consortiaRoutes } from './routes/consortia'
import { consortiaMediaRoutes } from './routes/consortia-media'
import { memberInvitesRoutes } from './routes/member-invites'
import { boatMembersRoutes } from './routes/boat-members'
import { boatAssetsRoutes } from './routes/boat-assets'
import { boatContactsRoutes } from './routes/boat-contacts'
import { orgAccountingRoutes } from './routes/org-accounting'
import { notificationsRoutes } from './routes/notifications'
import { isAisStreamConfigured } from './ais/aisstream-client'

const corsOrigins = getTrustedOrigins()

export const app = new Hono<ServerEnv>({ strict: false }).basePath('/api')

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

app.use('*', requestLogMiddleware)

app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'logmaster',
    ts: new Date().toISOString(),
    googleSignIn: isGoogleSignInEnabled(),
    googleWebClientId: getGoogleWebClientId(),
    mapTilerConfigured: Boolean(getMapTilerApiKeyFromEnv()),
    aisConfigured: isAisStreamConfigured(),
  }),
)

app.route('/logbook', logbookRoutes)
app.route('/logbook', logbookTrackRoutes)
app.route('/logbook', logbookStoryMediaRoutes)
app.route('/boats', boatsRoutes)
app.route('/boats', boatSharesRoutes)
app.route('/boats', boatMembersRoutes)
app.route('/boats', boatAssetsRoutes)
app.route('/boats', boatContactsRoutes)
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
app.route('/routes', routesApi)
app.route('/orgs', consortiaRoutes)
app.route('/orgs', consortiaMediaRoutes)
app.route('/orgs', orgAccountingRoutes)
app.route('/member-invites', memberInvitesRoutes)
app.route('/notifications', notificationsRoutes)
app.route('/places', placesRoutes)
app.route('/ais', aisRoutes)
