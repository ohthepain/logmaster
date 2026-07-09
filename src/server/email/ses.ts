import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

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

export function emailWrap(bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f1a1e;">
  <p>${bodyHtml}</p>
  <p style="color: #416166; font-size: 12px;">— ${appName()}</p>
  </body></html>`
}

export async function sendMagicLinkEmail(to: string, url: string) {
  const name = appName()
  const subject = `Sign in to ${name}`
  const text = `Click the link to sign in: ${url}\n\nThis link expires in a few minutes.`
  const html = emailWrap(
    `Sign in to <strong>${name}</strong> — <a href="${url}">click here</a>. This link expires in a few minutes.`,
  )
  await sendTransactionalEmail({ to, subject, text, html })
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const name = appName()
  const subject = `Reset your ${name} password`
  const text = `Click the link to set a new password: ${url}\n\nIf you did not request this, you can ignore this email.`
  const html = emailWrap(
    `Reset your <strong>${name}</strong> password — <a href="${url}">set a new password</a>. If you did not request this, ignore this email.`,
  )
  await sendTransactionalEmail({ to, subject, text, html })
}

export async function sendVerifyEmailEmail(to: string, url: string) {
  const name = appName()
  const subject = `Verify your email for ${name}`
  const text = `Verify your address: ${url}\n\nIf you did not create an account, you can ignore this email.`
  const html = emailWrap(
    `Please verify your email for <strong>${name}</strong> — <a href="${url}">verify</a>.`,
  )
  await sendTransactionalEmail({ to, subject, text, html })
}
