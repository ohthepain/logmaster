import type { InviteLocale } from '../../lib/invite-locale'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { escapeHtml, renderTransactionalEmail } from './html'

type NotificationCopy = {
  openInApp: string
  preheaderFallback: string
}

const copy: Record<InviteLocale, NotificationCopy> = {
  en: {
    openInApp: 'Open in {appName}',
    preheaderFallback: 'You have a new notification.',
  },
  sv: {
    openInApp: 'Öppna i {appName}',
    preheaderFallback: 'Du har en ny avisering.',
  },
  da: {
    openInApp: 'Åbn i {appName}',
    preheaderFallback: 'Du har en ny notifikation.',
  },
  de: {
    openInApp: 'In {appName} öffnen',
    preheaderFallback: 'Du hast eine neue Benachrichtigung.',
  },
  es: {
    openInApp: 'Abrir en {appName}',
    preheaderFallback: 'Tienes una nueva notificación.',
  },
  fr: {
    openInApp: 'Ouvrir dans {appName}',
    preheaderFallback: 'Vous avez une nouvelle notification.',
  },
  nl: {
    openInApp: 'Openen in {appName}',
    preheaderFallback: 'Je hebt een nieuwe melding.',
  },
  pt: {
    openInApp: 'Abrir em {appName}',
    preheaderFallback: 'Tem uma nova notificação.',
  },
  fi: {
    openInApp: 'Avaa palvelussa {appName}',
    preheaderFallback: 'Sinulla on uusi ilmoitus.',
  },
  el: {
    openInApp: 'Άνοιγμα στο {appName}',
    preheaderFallback: 'Έχετε νέα ειδοποίηση.',
  },
  tr: {
    openInApp: '{appName} içinde aç',
    preheaderFallback: 'Yeni bir bildiriminiz var.',
  },
  vi: {
    openInApp: 'Mở trong {appName}',
    preheaderFallback: 'Bạn có thông báo mới.',
  },
  ja: {
    openInApp: '{appName}で開く',
    preheaderFallback: '新しい通知があります。',
  },
  ko: {
    openInApp: '{appName}에서 열기',
    preheaderFallback: '새 알림이 있습니다.',
  },
  zh: {
    openInApp: '在 {appName} 中打开',
    preheaderFallback: '您有一条新通知。',
  },
  yue: {
    openInApp: '喺 {appName} 開啟',
    preheaderFallback: '你有新通知。',
  },
  ar: {
    openInApp: 'فتح في {appName}',
    preheaderFallback: 'لديك إشعار جديد.',
  },
}

function stringsFor(locale: InviteLocale): NotificationCopy {
  return copy[locale] ?? copy.en
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

export function buildNotificationEmail(args: {
  locale: unknown
  appName: string
  title: string
  body: string
  url: string | null
}) {
  const locale = normalizeInviteLocale(args.locale)
  const strings = stringsFor(locale)
  const appName = args.appName.trim() || 'logmaster'
  const title = args.title.trim() || strings.preheaderFallback
  const bodyText = args.body.trim()
  const introHtml = escapeHtml(bodyText || title)
  const ctaLabel = fill(strings.openInApp, { appName })

  const text = args.url
    ? `${bodyText || title}\n\n${ctaLabel}: ${args.url}`
    : bodyText || title

  const html = renderTransactionalEmail({
    locale,
    appName,
    preheader: bodyText || strings.preheaderFallback,
    title,
    introHtml,
    ...(args.url ? { ctaLabel, ctaUrl: args.url } : {}),
    footnoteHtml: '',
  })

  return { subject: title, text, html, locale }
}
