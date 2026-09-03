import type { AisBoundingBox } from '../../domain/ais-vessel'
import { upsertAisVessel } from './ais-vessel-cache'
import { parseAisStreamMessage } from './parse-aisstream-message'
import {
  aisStreamBoxesFromBboxes,
  decodeAisStreamWebSocketMessage,
  splitAisSubscriptionBoxes,
} from './aisstream-utils'

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream'
const SUBSCRIPTION_MIN_INTERVAL_MS = 1100
const RECONNECT_BASE_MS = 2000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let activeSubscriptionBoxes: AisBoundingBox[] = []
let activeViewportBbox: AisBoundingBox | null = null
let lastSubscriptionSentAt = 0
let connectPromise: Promise<void> | null = null

export function isAisStreamConfigured(): boolean {
  return Boolean(process.env.AISSTREAM_API_KEY?.trim())
}

function scheduleReconnect() {
  if (reconnectTimer || activeSubscriptionBoxes.length === 0 || !isAisStreamConfigured()) {
    return
  }
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, 30_000)
  reconnectAttempts += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectPromise = null
    if (activeViewportBbox) {
      void ensureAisStreamSubscription(activeViewportBbox)
    }
  }, delay)
}

function sendSubscription(boxes: AisBoundingBox[]) {
  if (!socket || socket.readyState !== WebSocket.OPEN || boxes.length === 0) return
  const apiKey = process.env.AISSTREAM_API_KEY?.trim()
  if (!apiKey) return

  const now = Date.now()
  if (now - lastSubscriptionSentAt < SUBSCRIPTION_MIN_INTERVAL_MS) return
  lastSubscriptionSentAt = now

  socket.send(
    JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: aisStreamBoxesFromBboxes(boxes),
    }),
  )
}

function attachSocketHandlers(ws: WebSocket) {
  ws.addEventListener('open', () => {
    reconnectAttempts = 0
    if (activeSubscriptionBoxes.length > 0) {
      sendSubscription(activeSubscriptionBoxes)
    }
  })

  ws.addEventListener('message', (event) => {
    void (async () => {
      try {
        const text = await decodeAisStreamWebSocketMessage(event.data)
        const payload = JSON.parse(text)
        const update = parseAisStreamMessage(payload)
        if (!update?.mmsi) return
        upsertAisVessel({ ...update, mmsi: update.mmsi })
      } catch {
        /* ignore malformed frames */
      }
    })()
  })

  ws.addEventListener('close', () => {
    socket = null
    connectPromise = null
    scheduleReconnect()
  })

  ws.addEventListener('error', () => {
    ws.close()
  })
}

async function openSocket(): Promise<void> {
  if (!isAisStreamConfigured()) return
  if (socket && socket.readyState === WebSocket.OPEN) return
  if (connectPromise) return connectPromise

  connectPromise = new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(AISSTREAM_URL)
    socket = ws

    ws.addEventListener('open', () => resolve(), { once: true })
    ws.addEventListener('error', () => reject(new Error('AIS stream connection failed')), {
      once: true,
    })

    attachSocketHandlers(ws)
  })
    .catch((error) => {
      socket = null
      throw error
    })
    .finally(() => {
      connectPromise = null
    })

  return connectPromise
}

/** Ensure the server is subscribed to AIS for the requested viewport. */
export async function ensureAisStreamSubscription(viewportBbox: AisBoundingBox) {
  if (!isAisStreamConfigured()) return
  activeViewportBbox = viewportBbox
  activeSubscriptionBoxes = splitAisSubscriptionBoxes(viewportBbox)
  try {
    await openSocket()
    sendSubscription(activeSubscriptionBoxes)
  } catch {
    /* return cached vessels when the live feed is temporarily unavailable */
  }
}

/** Test helper — closes any open AIS stream connection. */
export async function resetAisStreamClientForTests() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  activeSubscriptionBoxes = []
  activeViewportBbox = null
  reconnectAttempts = 0
  lastSubscriptionSentAt = 0
  connectPromise = null
  if (socket) {
    socket.close()
    socket = null
  }
}

export { activeSubscriptionBoxes as activeAisSubscriptionBoxesForTests }
