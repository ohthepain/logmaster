import type { NotificationTopic } from '../../domain/notifications'
import type { InviteLocale } from '../../lib/invite-locale'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { getActivityNotificationStrings } from './activity-copy'

export type NotificationAction =
  | { key: 'uploadedPhoto' }
  | { key: 'updatedPhoto' }
  | { key: 'deletedPhoto' }
  | { key: 'addedDocumentCategory' }
  | { key: 'uploadedDocument' }
  | { key: 'addedDocumentLink' }
  | { key: 'updatedDocument' }
  | { key: 'deletedDocument' }
  | { key: 'addedAsset'; name: string }
  | { key: 'updatedAsset'; name: string }
  | { key: 'removedAsset'; name: string }
  | { key: 'loggedWorkOnAsset'; name: string }
  | { key: 'sentMemberInvite' }
  | { key: 'addedMember' }
  | { key: 'createdMemberInviteLink' }
  | { key: 'changedMemberRole' }
  | { key: 'removedMember' }
  | { key: 'joinedOrg' }
  | { key: 'addedContact'; name: string }
  | { key: 'updatedContact' }
  | { key: 'removedContact' }
  | { key: 'updatedShareStructure' }
  | { key: 'updatedShareLabel' }
  | { key: 'assignedShareOwner' }
  | { key: 'removedShareOwner' }
  | { key: 'attachedBoat'; name: string }

export type ActivityNotificationLocalization =
  | {
      kind: 'resourceSection'
      topic: NotificationTopic
      resourceName: string
      actorName: string
      action: NotificationAction
    }
  | {
      kind: 'tripCompleted'
      boatName: string
      tripTitle: string
      actorName: string
    }
  | {
      kind: 'adminJob'
      success: boolean
      queueName: string
      jobId: string
      summary: string
    }

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

export function renderActivityNotification(
  localization: ActivityNotificationLocalization,
  localeInput: unknown,
): { title: string; body: string } {
  const locale = normalizeInviteLocale(localeInput)
  const strings = getActivityNotificationStrings(locale)

  if (localization.kind === 'adminJob') {
    const title = localization.success
      ? strings.adminJobCompletedTitle
      : strings.adminJobFailedTitle
    const body = fill(strings.adminJobBody, {
      queueName: localization.queueName,
      jobId: localization.jobId,
      summary: localization.summary,
    })
    return { title, body }
  }

  if (localization.kind === 'tripCompleted') {
    const title = fill(strings.tripCompletedTitle, {
      boatName: localization.boatName,
    })
    const body = fill(strings.tripCompletedBody, {
      tripTitle: localization.tripTitle,
    })
    return { title, body }
  }

  const sectionLabel =
    strings.sectionByTopic[localization.topic] ?? strings.sectionFallback
  const title = fill(strings.resourceSectionTitle, {
    resourceName: localization.resourceName,
    section: sectionLabel,
  })
  const actionPhrase = renderActionPhrase(locale, localization.action)
  const body = fill(strings.resourceSectionBody, {
    actor: localization.actorName,
    action: actionPhrase,
  })
  return { title, body }
}

function renderActionPhrase(
  locale: InviteLocale,
  action: NotificationAction,
): string {
  const strings = getActivityNotificationStrings(locale)
  const templates = strings.actions

  switch (action.key) {
    case 'uploadedPhoto':
      return templates.uploadedPhoto
    case 'updatedPhoto':
      return templates.updatedPhoto
    case 'deletedPhoto':
      return templates.deletedPhoto
    case 'addedDocumentCategory':
      return templates.addedDocumentCategory
    case 'uploadedDocument':
      return templates.uploadedDocument
    case 'addedDocumentLink':
      return templates.addedDocumentLink
    case 'updatedDocument':
      return templates.updatedDocument
    case 'deletedDocument':
      return templates.deletedDocument
    case 'addedAsset':
      return fill(templates.addedAsset, { name: action.name })
    case 'updatedAsset':
      return fill(templates.updatedAsset, { name: action.name })
    case 'removedAsset':
      return fill(templates.removedAsset, { name: action.name })
    case 'loggedWorkOnAsset':
      return fill(templates.loggedWorkOnAsset, { name: action.name })
    case 'sentMemberInvite':
      return templates.sentMemberInvite
    case 'addedMember':
      return templates.addedMember
    case 'createdMemberInviteLink':
      return templates.createdMemberInviteLink
    case 'changedMemberRole':
      return templates.changedMemberRole
    case 'removedMember':
      return templates.removedMember
    case 'joinedOrg':
      return templates.joinedOrg
    case 'addedContact':
      return fill(templates.addedContact, { name: action.name })
    case 'updatedContact':
      return templates.updatedContact
    case 'removedContact':
      return templates.removedContact
    case 'updatedShareStructure':
      return templates.updatedShareStructure
    case 'updatedShareLabel':
      return templates.updatedShareLabel
    case 'assignedShareOwner':
      return templates.assignedShareOwner
    case 'removedShareOwner':
      return templates.removedShareOwner
    case 'attachedBoat':
      return fill(templates.attachedBoat, { name: action.name })
    default:
      return templates.updatedDocument
  }
}

export function renderChatMessageNotification(args: {
  locale: unknown
  isDirectMessage: boolean
  threadName: string
}): { title: string; body: string } {
  const strings = getActivityNotificationStrings(normalizeInviteLocale(args.locale))
  return {
    title: args.isDirectMessage ? strings.chatNewMessageTitle : args.threadName,
    body: strings.chatNewMessageBody,
  }
}
