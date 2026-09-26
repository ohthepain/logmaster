import { Check, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import type { NotificationTopic } from '../domain/notifications'
import { useTranslation } from '../lib/i18n'
import { MessagesButton } from './MessagesButton'
import {
  NotificationBellToggle,
  ResourceAddButton,
  ResourceRefreshButton,
} from './NotificationBellToggle'

export const resourcePeopleRowClassName =
  'relative flex min-h-19 items-center gap-3 px-3 py-3 sm:px-4 after:absolute after:bottom-0 after:left-16 after:right-0 after:h-px after:bg-[var(--line)] last:after:hidden'

export function ResourcePeopleHeader({
  title,
  description,
  boatId,
  topic,
  editing,
  onEdit,
  onAdd,
  addLabel,
  onRefresh,
  refreshing,
  actions,
}: {
  title: string
  description: ReactNode
  boatId?: string
  topic?: NotificationTopic
  editing: boolean
  onEdit?: () => void
  onAdd?: () => void
  addLabel: string
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const EditIcon = editing ? Check : Pencil
  return (
    <div className="mb-4 px-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <h2 className="m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {boatId ? (
            <MessagesButton
              threadId={`boat:${boatId}`}
              ariaLabel={t('messages')}
              className="!size-10 !border-0 !bg-transparent"
            />
          ) : null}
          {topic ? (
            <NotificationBellToggle
              topic={topic}
              boatId={boatId}
              buttonClassName="!size-10 !border-0 !bg-transparent"
            />
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t(editing ? 'done' : 'edit')}
              title={t(editing ? 'done' : 'edit')}
              aria-pressed={editing}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--brand)] outline-none hover:bg-[var(--chip-bg)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              <EditIcon className="size-5" aria-hidden />
            </button>
          ) : null}
          {onAdd ? (
            <ResourceAddButton
              onClick={onAdd}
              label={addLabel}
              className="!shadow-none"
            />
          ) : null}
          {onRefresh ? (
            <ResourceRefreshButton
              onRefresh={onRefresh}
              refreshing={refreshing}
              className="!size-10 !border-0 !bg-transparent"
            />
          ) : null}
          {actions}
        </div>
      </div>
      <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
        {description}
      </p>
    </div>
  )
}
