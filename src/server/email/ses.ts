import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import type { InviteLocale } from '../../lib/invite-locale'
import {
  buildMagicLinkEmail,
  buildPasswordResetEmail,
  buildVerifyEmailEmail,
} from './auth-copy'
import { buildCrewInviteEmail, buildMemberInviteEmail } from './invite-copy'
import { renderSimpleEmail } from './html'

/** Must match the region where SES identities are verified (see terraform `aws_region`). */
const region = process.env.AWS_REGION || 'eu-central-1'
let client: SESClient | null = null

function getClient(): SESClient {
  if (!client) client = new SESClient({ region })
  return client
}

const appName = () => process.env.EMAIL_APP_NAME || 'logmaster'

function configurationSetName(): string | undefined {
  const name = process.env.SES_CONFIGURATION_SET?.trim()
  return name || undefined
}

export async function sendTransactionalEmail(args: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<void> {
  const from = process.env.AWS_SES_FROM_EMAIL
  if (!from) {
    if (process.env.NODE_ENV === 'development') {
      console.info(
        '[email] AWS_SES_FROM_EMAIL not set — would send to',
        args.to,
        '—',
        args.subject,
      )
      console.info(args.text)
    } else {
      console.error(
        '[email] AWS_SES_FROM_EMAIL is required to send email in production',
      )
    }
    return
  }
  try {
    await getClient().send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [args.to] },
        ...(configurationSetName()
          ? { ConfigurationSetName: configurationSetName() }
          : {}),
        Message: {
          Subject: { Data: args.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: args.text, Charset: 'UTF-8' },
            Html: { Data: args.html, Charset: 'UTF-8' },
          },
        },
      }),
    )
  } catch (e) {
    console.error('[email] SES send failed', e)
    throw e
  }
}

/** @deprecated Prefer transactional email builders. */
export function emailWrap(bodyHtml: string) {
  return renderSimpleEmail({ appName: appName(), bodyHtml })
}

export async function sendMagicLinkEmail(
  to: string,
  url: string,
  options?: { locale?: InviteLocale | string | null },
) {
  const content = buildMagicLinkEmail({
    locale: options?.locale,
    appName: appName(),
    url,
  })
  await sendTransactionalEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
  options?: { locale?: InviteLocale | string | null },
) {
  const content = buildPasswordResetEmail({
    locale: options?.locale,
    appName: appName(),
    url,
  })
  await sendTransactionalEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}

export async function sendVerifyEmailEmail(
  to: string,
  url: string,
  options?: { locale?: InviteLocale | string | null },
) {
  const content = buildVerifyEmailEmail({
    locale: options?.locale,
    appName: appName(),
    url,
  })
  await sendTransactionalEmail({
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}

export async function sendCrewInviteEmail(args: {
  to: string
  url: string
  inviterName: string
  locale?: InviteLocale | string | null
}) {
  const content = buildCrewInviteEmail({
    locale: args.locale,
    appName: appName(),
    inviterName: args.inviterName,
    url: args.url,
  })
  await sendTransactionalEmail({
    to: args.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}

export async function sendMemberInviteEmail(args: {
  to: string
  url: string
  inviterName: string
  targetName: string | null | undefined
  targetKind: 'org' | 'boat'
  locale?: InviteLocale | string | null
}) {
  const content = buildMemberInviteEmail({
    locale: args.locale,
    appName: appName(),
    inviterName: args.inviterName,
    targetName: args.targetName,
    targetKind: args.targetKind,
    url: args.url,
  })
  await sendTransactionalEmail({
    to: args.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}
