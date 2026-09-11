export type LogOutcome =
  | 'success'
  | 'conflict'
  | 'forbidden'
  | 'validation_failed'
  | 'error'

export type ServerLogLevel = 'info' | 'warn' | 'error'

type ServerLogBase = {
  timestamp: string
  level: ServerLogLevel
  kind: 'http_request' | 'server_event'
  requestId?: string
  userId?: string | null
  method?: string
  path?: string
  httpStatus?: number
  durationMs?: number
  errorCode?: string
  action?: string
  resourceType?: string
  resourceId?: string
  outcome?: LogOutcome
  tripsUpserted?: number
  legsUpserted?: number
  logEntriesUpserted?: number
  tripTracksUpserted?: number
  mediaUpserted?: number
  tripsDeleted?: number
  mediaDeleted?: number
}

export type HttpRequestLog = ServerLogBase & {
  kind: 'http_request'
}

export type ServerEventLog = ServerLogBase & {
  kind: 'server_event'
}

export type ServerLogLine = HttpRequestLog | ServerEventLog

export function httpStatusToErrorCode(status: number): string | undefined {
  if (status < 400) return undefined
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 422) return 'validation_failed'
  if (status >= 500) return 'internal_error'
  return 'client_error'
}

function writeLog(line: ServerLogLine) {
  const payload: Record<string, unknown> = { service: 'logmaster' }
  for (const [key, value] of Object.entries(line)) {
    if (value !== undefined) payload[key] = value
  }
  const output = JSON.stringify(payload)
  if (line.level === 'error') {
    console.error(output)
  } else if (line.level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export function logHttpRequest(fields: Omit<HttpRequestLog, 'kind' | 'timestamp' | 'level'> & {
  level?: ServerLogLevel
}) {
  const status = fields.httpStatus ?? 0
  const level =
    fields.level ??
    (status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info')
  const errorCode =
    fields.errorCode ?? httpStatusToErrorCode(status)

  writeLog({
    kind: 'http_request',
    timestamp: new Date().toISOString(),
    level,
    ...fields,
    errorCode,
  })
}

export function logServerEvent(
  fields: Omit<ServerEventLog, 'kind' | 'timestamp' | 'level'> & {
    level?: ServerLogLevel
  },
) {
  const level =
    fields.level ??
    (fields.outcome === 'error' || fields.outcome === 'forbidden'
      ? 'warn'
      : 'info')

  writeLog({
    kind: 'server_event',
    timestamp: new Date().toISOString(),
    level,
    ...fields,
  })
}
