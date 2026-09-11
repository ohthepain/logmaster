import { Check, ChevronDown } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { CrewAvatar } from './CrewAvatar'
import type { TripPersonOption } from '../lib/trip-people'
import { cn } from '../lib/cn'
import { DevComponentLabel } from './DevComponentLabel'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'

type SkipperSelectProps = {
  value: string
  options: TripPersonOption[]
  onChange: (key: string) => void
}

export function SkipperSelect({
  value,
  options,
  onChange,
}: SkipperSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected =
    options.find((option) => option.key === value) ?? options.at(0) ?? null

  const selectOption = (key: string) => {
    onChange(key)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', open && POPUP_MENU_Z_CLASS)}>
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <DevComponentLabel
        name="SkipperSelect"
        className="absolute -top-5 left-0"
      />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-2.5 text-left outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
      >
        {selected ? (
          <>
            <CrewAvatar
              name={selected.name}
              imageUrl={selected.imageUrl}
              userId={
                selected.kind === 'user'
                  ? selected.id
                  : (selected.linkedUserId ?? undefined)
              }
              className="size-10"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--sea-ink)]">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="text-sm text-[var(--sea-ink-soft)]">
            Select skipper…
          </span>
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-[var(--sea-ink-soft)] transition',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            'absolute mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-1 shadow-lg',
            POPUP_MENU_Z_CLASS,
          )}
        >
          {options.map((option) => {
            const active = option.key === value
            return (
              <li key={option.key} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectOption(option.key)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--chip-bg)]',
                    active && 'bg-[var(--chip-bg)]',
                  )}
                >
                  <CrewAvatar
                    name={option.name}
                    imageUrl={option.imageUrl}
                    userId={
                      option.kind === 'user'
                        ? option.id
                        : (option.linkedUserId ?? undefined)
                    }
                    className="size-10"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--sea-ink)]">
                    {option.name}
                  </span>
                  {active && (
                    <Check
                      className="size-4 shrink-0 text-[var(--brand)]"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
