import type { InviteLocale } from '../../lib/invite-locale'

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function emailDirection(locale: InviteLocale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export type TransactionalEmailLayout = {
  locale: InviteLocale
  appName: string
  preheader?: string
  title: string
  introHtml: string
  ctaLabel?: string
  ctaUrl?: string
  footnoteHtml: string
}

export function renderTransactionalEmail(layout: TransactionalEmailLayout): string {
  const dir = emailDirection(layout.locale)
  const appName = escapeHtml(layout.appName)
  const preheader = layout.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(layout.preheader)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="${layout.locale}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(layout.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;color:#0a0a0a;">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;border-bottom:1px solid rgba(0,0,0,0.06);">
              <p style="margin:0;font-family:Fraunces, Georgia, serif;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0a0a0a;">${appName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:700;color:#0a0a0a;">${escapeHtml(layout.title)}</h1>
              <div style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#525252;">${layout.introHtml}</div>
              ${
                layout.ctaUrl && layout.ctaLabel
                  ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:999px;background:#0a0a0a;">
                    <a href="${escapeHtml(layout.ctaUrl)}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(layout.ctaLabel)}</a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              ${layout.footnoteHtml ? `<p style="margin:0;font-size:13px;line-height:1.55;color:#737373;">${layout.footnoteHtml}</p>` : ''}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#737373;">${appName}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderSimpleEmail(args: {
  locale?: InviteLocale
  appName: string
  bodyHtml: string
}): string {
  const locale = args.locale ?? 'en'
  const dir = emailDirection(locale)
  const appName = escapeHtml(args.appName)
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Manrope, ui-sans-serif, system-ui, sans-serif;color:#0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:20px;">
          <tr>
            <td style="padding:28px;font-size:16px;line-height:1.6;color:#525252;">${args.bodyHtml}</td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#737373;">— ${appName}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
