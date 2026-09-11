import { emailWrap, sendTransactionalEmail } from './ses'

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
}): Promise<void> {
  const appName = process.env.EMAIL_APP_NAME || 'logmaster'
  const subject = args.title
  const url = absoluteLinkUrl(args.linkUrl)
  const text = url ? `${args.body}\n\nOpen in ${appName}: ${url}` : args.body
  const html = emailWrap(
    `${args.body}${
      url ? `<br><br><a href="${url}">Open in ${appName}</a>` : ''
    }`,
  )
  await sendTransactionalEmail({ to: args.to, subject, text, html })
}
