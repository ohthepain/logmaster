import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import apn from '@parse/node-apn'

type ApnsConfig = {
  key: string | Buffer
  keyId: string
  teamId: string
  bundleId: string
  production: boolean
}

let provider: apn.Provider | null = null
let providerConfig: ApnsConfig | null = null

function resolveKeyPath(rawPath: string): string {
  return rawPath.startsWith('/') ? rawPath : resolve(process.cwd(), rawPath)
}

function readApnsKeyMaterial(): string | Buffer | null {
  const inline = process.env.APNS_KEY?.trim()
  if (inline) {
    return inline.replace(/\\n/g, '\n')
  }

  const keyPathRaw = process.env.APNS_KEY_PATH?.trim()
  if (!keyPathRaw) return null

  const keyPath = resolveKeyPath(keyPathRaw)
  if (!existsSync(keyPath)) {
    console.warn('[notifications] APNS key not found at', keyPath)
    return null
  }

  return readFileSync(keyPath, 'utf8')
}

export function getApnsConfig(): ApnsConfig | null {
  const key = readApnsKeyMaterial()
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const bundleId = process.env.APNS_BUNDLE_ID?.trim()
  if (!key || !keyId || !teamId || !bundleId) return null

  const productionRaw = process.env.APNS_PRODUCTION?.trim().toLowerCase()
  const production =
    productionRaw === 'true' || productionRaw === '1'
      ? true
      : productionRaw === 'false' || productionRaw === '0'
        ? false
        : process.env.NODE_ENV === 'production'

  return { key, keyId, teamId, bundleId, production }
}

function getApnsProvider(): apn.Provider | null {
  const config = getApnsConfig()
  if (!config) return null

  if (
    provider &&
    providerConfig &&
    providerConfig.key === config.key &&
    providerConfig.keyId === config.keyId &&
    providerConfig.teamId === config.teamId &&
    providerConfig.bundleId === config.bundleId &&
    providerConfig.production === config.production
  ) {
    return provider
  }

  provider?.shutdown()
  provider = new apn.Provider({
    token: {
      key: config.key,
      keyId: config.keyId,
      teamId: config.teamId,
    },
    production: config.production,
  })
  providerConfig = config
  return provider
}

const INVALID_APNS_REASONS = new Set([
  'BadDeviceToken',
  'Unregistered',
  'DeviceTokenNotForTopic',
  'ExpiredToken',
  'InvalidProviderToken',
])

export async function sendApnsMessage(args: {
  token: string
  title: string
  body: string
  linkUrl: string | null
  notificationId: string
}): Promise<'sent' | 'invalid-token' | 'skipped' | 'failed'> {
  const apnsProvider = getApnsProvider()
  const config = getApnsConfig()
  if (!apnsProvider || !config) return 'skipped'

  const notification = new apn.Notification()
  notification.topic = config.bundleId
  notification.pushType = 'alert'
  notification.priority = 10
  notification.alert = {
    title: args.title,
    body: args.body,
  }
  notification.sound = 'default'
  notification.payload = {
    linkUrl: args.linkUrl ?? '',
    notificationId: args.notificationId,
  }

  const result = await apnsProvider.send(notification, args.token)

  if (result.failed.length > 0) {
    const reason = result.failed[0]?.response?.reason
    if (reason && INVALID_APNS_REASONS.has(reason)) {
      return 'invalid-token'
    }
    console.warn('[notifications] APNS send failed', result.failed)
    return 'failed'
  }

  return 'sent'
}

export function isApnsConfigured(): boolean {
  return getApnsConfig() != null
}
