import type { Context } from 'hono'
import type { ServerEnv } from './hono-env'
import { logServerEvent } from './server-log'
import type { LogOutcome } from './server-log'

type ServerEventFields = {
  action: string
  outcome: LogOutcome
  resourceType?: string
  resourceId?: string
  errorCode?: string
  level?: 'info' | 'warn' | 'error'
  tripsUpserted?: number
  legsUpserted?: number
  logEntriesUpserted?: number
  tripTracksUpserted?: number
  mediaUpserted?: number
  tripsDeleted?: number
  mediaDeleted?: number
}

export function logServerEventFromContext(
  c: Context<ServerEnv>,
  fields: ServerEventFields,
) {
  logServerEvent({
    requestId: c.get('requestId'),
    userId: c.get('userId'),
    method: c.req.method,
    path: c.req.path,
    ...fields,
  })
}
