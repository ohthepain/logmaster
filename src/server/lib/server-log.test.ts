import { describe, expect, it, vi } from 'vitest'
import {
  httpStatusToErrorCode,
  logHttpRequest,
  logServerEvent,
} from './server-log'

describe('server-log', () => {
  it('maps HTTP status to stable error codes', () => {
    expect(httpStatusToErrorCode(200)).toBeUndefined()
    expect(httpStatusToErrorCode(401)).toBe('unauthorized')
    expect(httpStatusToErrorCode(403)).toBe('forbidden')
    expect(httpStatusToErrorCode(404)).toBe('not_found')
    expect(httpStatusToErrorCode(500)).toBe('internal_error')
  })

  it('writes JSON http_request lines', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logHttpRequest({
      requestId: 'req-1',
      method: 'GET',
      path: '/health',
      httpStatus: 200,
      durationMs: 12,
    })
    expect(spy).toHaveBeenCalledOnce()
    const line = JSON.parse(String(spy.mock.calls[0][0]))
    expect(line.kind).toBe('http_request')
    expect(line.requestId).toBe('req-1')
    expect(line.httpStatus).toBe(200)
    expect(line.service).toBe('logmaster')
    spy.mockRestore()
  })

  it('uses warn level for 403 responses', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logHttpRequest({
      requestId: 'req-2',
      method: 'POST',
      path: '/logbook/sync',
      httpStatus: 403,
      durationMs: 40,
    })
    expect(spy).toHaveBeenCalledOnce()
    const line = JSON.parse(String(spy.mock.calls[0][0]))
    expect(line.level).toBe('warn')
    expect(line.errorCode).toBe('forbidden')
    spy.mockRestore()
  })

  it('writes JSON server_event lines', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logServerEvent({
      requestId: 'req-3',
      userId: 'user-1',
      action: 'logbook.sync',
      outcome: 'success',
      tripsUpserted: 2,
    })
    expect(spy).toHaveBeenCalledOnce()
    const line = JSON.parse(String(spy.mock.calls[0][0]))
    expect(line.kind).toBe('server_event')
    expect(line.action).toBe('logbook.sync')
    expect(line.tripsUpserted).toBe(2)
    spy.mockRestore()
  })
})
