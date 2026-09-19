import { GoogleAuth } from 'google-auth-library'
import { logServerEvent } from '../lib/server-log'

export type FcmResult = 'sent' | 'invalid-token' | 'skipped' | 'failed'

let auth: GoogleAuth | undefined

function getAuth(): GoogleAuth {
  if (auth) return auth
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim()
  let credentials
  if (raw) {
    credentials = JSON.parse(raw)
    if (
      credentials?.type !== 'service_account' ||
      typeof credentials.client_email !== 'string' ||
      typeof credentials.private_key !== 'string'
    ) {
      throw new Error('Invalid FCM service account configuration')
    }
  }
  // GoogleAuth caches and refreshes short-lived OAuth tokens. Without inline
  // credentials it uses ADC (including GOOGLE_APPLICATION_CREDENTIALS).
  auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })
  return auth
}

export async function sendFcmMessage(args: {
  token: string
  title: string
  body: string
  linkUrl: string | null
  notificationId: string
}): Promise<FcmResult> {
  const record = (result: FcmResult, errorCode?: string): FcmResult => {
    logServerEvent({
      action: 'notification.fcm',
      resourceType: 'notification',
      resourceId: args.notificationId,
      outcome: result === 'sent' ? 'success' : 'error',
      ...(errorCode ? { errorCode } : {}),
    })
    return result
  }
  const projectId = process.env.FCM_PROJECT_ID?.trim()
  if (!projectId) return record('skipped', 'fcm_not_configured')

  let accessToken: string | null | undefined
  try {
    accessToken = await getAuth().getAccessToken()
    if (!accessToken) return record('failed', 'fcm_auth_failed')
  } catch {
    // Auth errors can contain credentials/request headers; never log them.
    return record('failed', 'fcm_auth_failed')
  }

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          message: {
            token: args.token,
            notification: { title: args.title, body: args.body },
            data: {
              linkUrl: args.linkUrl ?? '',
              notificationId: args.notificationId,
            },
          },
        }),
      },
    )
    if (response.ok) return record('sent')

    const payload = await response.json().catch(() => null)
    const details = payload?.error?.details
    const unregistered =
      Array.isArray(details) &&
      details.some(
        (detail) =>
          detail?.['@type'] ===
            'type.googleapis.com/google.firebase.fcm.v1.FcmError' &&
          detail.errorCode === 'UNREGISTERED',
      )
    if (response.status === 404 && unregistered) {
      return record('invalid-token', 'fcm_unregistered')
    }
    // A generic 404, INVALID_ARGUMENT, or sender mismatch can indicate a
    // project/payload/configuration problem. Keep the registration intact.
    return record('failed', `fcm_http_${response.status}`)
  } catch {
    return record('failed', 'fcm_request_failed')
  }
}
