import { buildNotificationEmail } from './notification-copy'
import { sendTransactionalEmail } from './ses'

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

export async function sendNotificationEmail(args: {
  to: string
  title: string
  body: string
  linkUrl: string | null
  locale?: string | null
}): Promise<void> {
  const appName = process.env.EMAIL_APP_NAME || 'logmaster'
  const url = absoluteLinkUrl(args.linkUrl)
  const content = buildNotificationEmail({
    locale: args.locale,
    appName,
    title: args.title,
    body: args.body,
    url,
  })
  await sendTransactionalEmail({
    to: args.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  })
}
