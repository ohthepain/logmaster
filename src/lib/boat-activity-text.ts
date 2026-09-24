import type { BoatChatActivity } from '../domain/boat-activity'
import type { TranslationKey } from './i18n'

type Translate = (key: TranslationKey) => string

function roleLabel(role: string | null | undefined, t: Translate) {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
    case 'MEMBER':
    case 'VIEWER':
      return t(`boatActivity_role_${role}`)
    default:
      return ''
  }
}

export function boatActivityTextParts(
  activity: BoatChatActivity,
  t: Translate,
) {
  const isMember = activity.kind.startsWith('MEMBER_')
  const role = isMember ? roleLabel(activity.memberRole, t) : ''
  const previousRole = roleLabel(activity.previousMemberRole, t)
  const roleChanged =
    activity.kind === 'MEMBER_UPDATED' &&
    role &&
    previousRole &&
    activity.memberRole !== activity.previousMemberRole
  return {
    heading: t(
      roleChanged
        ? 'boatActivity_roleChanged'
        : `boatActivity_${activity.kind}`,
    ),
    label: activity.label || (isMember ? t('boatActivity_member') : ''),
    detail: roleChanged ? `${previousRole} → ${role}` : role,
  }
}

export function boatActivitySummary(activity: BoatChatActivity, t: Translate) {
  const { heading, label, detail } = boatActivityTextParts(activity, t)
  return (
    [heading, label, detail].filter(Boolean).join(' · ') +
    (activity.targetLabel ? ` ↔ ${activity.targetLabel}` : '')
  )
}
