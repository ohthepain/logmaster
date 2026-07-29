import type { SignKSnapshot } from '../../domain/instrument-data'

/** Phase 2: WebSocket client for Signal K server instrument data. */
export type SignalKConnectionOptions = {
  host: string
  port?: number
  useTls?: boolean
}

export type SignalKClient = {
  connect: (options: SignalKConnectionOptions) => Promise<void>
  disconnect: () => Promise<void>
  subscribe: (listener: (snapshot: SignKSnapshot) => void) => () => void
}

export function createSignalKClient(): SignalKClient {
  return {
    async connect() {
      throw new Error('Signal K integration is not implemented yet.')
    },
    async disconnect() {},
    subscribe() {
      return () => {}
    },
  }
}
