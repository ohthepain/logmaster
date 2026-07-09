import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth, getTrustedOrigins } from './auth'
import { logbookRoutes } from './routes/logbook'
import { boatsRoutes } from './routes/boats'
import { profileRoutes } from './routes/profile'
import { crewRoutes } from './routes/crew'

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
  c.json({ ok: true, service: 'logmaster', ts: new Date().toISOString() }),
)

app.route('/logbook', logbookRoutes)
app.route('/boats', boatsRoutes)
app.route('/profile', profileRoutes)
app.route('/crew', crewRoutes)
