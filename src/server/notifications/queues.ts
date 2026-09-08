export const SEND_NOTIFICATION_EMAIL_QUEUE = 'send_notification_email'
export const SEND_NOTIFICATION_PUSH_QUEUE = 'send_notification_push'

export type NotificationEmailJobPayload = {
  notificationId: string
  userId: string
  title: string
  body: string
  linkUrl: string | null
}

export type NotificationPushJobPayload = {
  notificationId: string
  userId: string
  title: string
  body: string
  linkUrl: string | null
}

export type NotificationDeliveryTarget = {
  notificationId: string
  userId: string
  title: string
  body: string
  linkUrl: string | null
  emailEnabled: boolean
  pushEnabled: boolean
}
