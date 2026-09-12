import { ChevronDown, Languages } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { languages, useTranslation } from '../lib/i18n'
import { cn } from '../lib/cn'
import { POPUP_MENU_Z_CLASS } from './PopupOutsideDismiss'

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = languages.find((item) => item.code === language) ?? languages[0]
  const languageOptions = [...languages].sort((left, right) =>
    left.nativeName.localeCompare(right.nativeName, 'en'),
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--sea-ink)]">
        <Languages className="size-4 shrink-0" aria-hidden />
        <span>{t('language')}</span>
        <button
          type="button"
          aria-label={t('language')}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-w-40 flex-1 items-center justify-between gap-2 rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-2 py-1 text-left text-sm text-[var(--sea-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {selected.flag}
            </span>
            <span className="truncate">{selected.nativeName}</span>
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 transition', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('language')}
          className={cn(
            'absolute inset-x-0 top-[calc(100%+0.35rem)] mt-0 max-h-80 list-none overflow-y-auto rounded-xl border border-[var(--chip-line)] bg-[var(--surface-strong)] p-1 shadow-lg',
            POPUP_MENU_Z_CLASS,
          )}
        >
          {languageOptions.map((item) => {
            const isSelected = item.code === language
            return (
              <li key={item.code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setLanguage(item.code)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[var(--sea-ink)]',
                    isSelected
                      ? 'bg-[var(--chip-bg)] font-semibold'
                      : 'hover:bg-[var(--link-bg-hover)]',
                  )}
                >
                  <span aria-hidden className="text-base leading-none">
                    {item.flag}
                  </span>
                  <span>{item.nativeName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
