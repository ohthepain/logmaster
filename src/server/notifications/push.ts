import webpush from 'web-push'
import { prisma } from '../db'
import { sendApnsMessage } from './apns'
import { logServerEvent } from '../lib/server-log'

const db = prisma as any

function appOrigin(): string {
  return (
    process.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'https://logmaster.live'
  )
}

function absoluteLinkUrl(linkUrl: string | null): string | null {
  if (!linkUrl) return null
  if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
    return linkUrl
  }
  return `${appOrigin()}${linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`}`
}

let webPushConfigured = false

function ensureWebPushConfigured(): boolean {
  if (webPushConfigured) return true
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim()
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim()
  const subject =
    process.env.WEB_PUSH_SUBJECT?.trim() ||
    `mailto:${process.env.AWS_SES_FROM_EMAIL || 'support@logmaster.live'}`
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  webPushConfigured = true
  return true
}

async function sendFcmMessage(args: {
  token: string
  title: string
  body: string
  linkUrl: string | null
}): Promise<boolean> {
  const serverKey = process.env.FCM_SERVER_KEY?.trim()
  if (!serverKey) return false

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: args.token,
      notification: {
        title: args.title,
        body: args.body,
      },
      data: {
        linkUrl: args.linkUrl ?? '',
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.warn('[notifications] FCM send failed', response.status, text)
    return false
  }

  const payload = (await response.json()) as {
    failure?: number
    results?: Array<{ error?: string }>
  }
  const error = payload.results?.[0]?.error
  if (payload.failure && error) {
    if (
      error === 'NotRegistered' ||
      error === 'InvalidRegistration' ||
      error === 'MismatchSenderId'
    ) {
      return false
    }
    console.warn('[notifications] FCM error', error)
    return false
  }
  return true
}

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_PUBLIC_KEY?.trim() || null
}

export async function sendPushToUser(args: {
  userId: string
  title: string
  body: string
  linkUrl: string | null
  notificationId: string
}): Promise<void> {
  const devices = await db.pushDevice.findMany({
    where: { userId: args.userId },
  })
  if (devices.length === 0) {
    logServerEvent({
      action: 'notification.push',
      resourceType: 'notification',
      resourceId: args.notificationId,
      userId: args.userId,
      outcome: 'error',
      errorCode: 'no_push_device',
    })
    return
  }

  const linkUrl = absoluteLinkUrl(args.linkUrl)
  const payload = JSON.stringify({
    title: args.title,
    body: args.body,
    linkUrl,
    notificationId: args.notificationId,
  })

  for (const device of devices) {
    try {
      if (device.platform === 'web') {
        if (!ensureWebPushConfigured()) continue
        if (!device.endpoint || !device.p256dh || !device.auth) continue
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: {
              p256dh: device.p256dh,
              auth: device.auth,
            },
          },
          payload,
        )
      } else if (device.platform === 'ios') {
        const result = await sendApnsMessage({
          token: device.token,
          title: args.title,
          body: args.body,
          linkUrl,
          notificationId: args.notificationId,
        })
        if (result === 'invalid-token') {
          logServerEvent({
            action: 'notification.push',
            resourceType: 'push_device',
            resourceId: device.id,
            userId: args.userId,
            outcome: 'error',
            errorCode: 'invalid_apns_token',
          })
          await db.pushDevice.delete({ where: { id: device.id } })
        } else if (result === 'skipped') {
          logServerEvent({
            action: 'notification.push',
            resourceType: 'push_device',
            resourceId: device.id,
            userId: args.userId,
            outcome: 'error',
            errorCode: 'apns_not_configured',
          })
        } else if (result === 'failed') {
          logServerEvent({
            action: 'notification.push',
            resourceType: 'push_device',
            resourceId: device.id,
            userId: args.userId,
            outcome: 'error',
            errorCode: 'apns_send_failed',
          })
        }
      } else if (device.platform === 'android') {
        const ok = await sendFcmMessage({
          token: device.token,
          title: args.title,
          body: args.body,
          linkUrl,
        })
        if (!ok) {
          await db.pushDevice.delete({ where: { id: device.id } })
        }
      }
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number((error as { statusCode: number }).statusCode)
          : null
      if (statusCode === 404 || statusCode === 410) {
        await db.pushDevice.delete({ where: { id: device.id } })
        continue
      }
      console.warn('[notifications] push send failed', device.id, error)
    }
  }
}
