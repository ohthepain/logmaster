import { MoreHorizontal } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type BoatPhotoActionsMenuProps = {
  isDefault: boolean
  onMakeProfile: () => void | Promise<void>
  onDelete: () => void
  disabled?: boolean
  className?: string
}

export function BoatPhotoActionsMenu({
  isDefault,
  onMakeProfile,
  onDelete,
  disabled = false,
  className,
}: BoatPhotoActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const runAction = async (action: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const menuDisabled = disabled || busy

  return (
    <div
      className={cn('absolute right-1.5 top-1.5 sm:right-2 sm:top-2', className)}
      ref={rootRef}
      data-photo-menu
      onPointerDown={(event) => event.stopPropagation()}
    >
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Photo options"
        disabled={menuDisabled}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className="inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white outline-none transition hover:bg-black/65 disabled:opacity-60"
      >
        <MoreHorizontal className="size-4" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Photo options"
          className={cn(
            'absolute right-0 top-full mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-xl',
            POPUP_MENU_Z_CLASS,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {!isDefault ? (
            <button
              type="button"
              role="menuitem"
              disabled={menuDisabled}
              onClick={() => void runAction(onMakeProfile)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)] outline-none hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Make profile
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={menuDisabled}
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 outline-none hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
