import { Pencil } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type LogEntryPhotoMenuProps = {
  onDelete: () => void
  onSetMetadata?: () => void | Promise<void>
  metadataBusy?: boolean
  className?: string
}

export function LogEntryPhotoMenu({
  onDelete,
  onSetMetadata,
  metadataBusy = false,
  className,
}: LogEntryPhotoMenuProps) {
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

  const disabled = busy || metadataBusy

  return (
    <div className={cn('absolute right-2 top-2', className)} ref={rootRef}>
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Photo options"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white outline-none transition hover:bg-black/65 disabled:opacity-60"
      >
        <Pencil className="size-4" />
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
        >
          {onSetMetadata ? (
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => void runAction(onSetMetadata)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)] outline-none hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              {metadataBusy ? 'Setting metadata…' : 'Set metadata'}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => void runAction(onDelete)}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 outline-none hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
