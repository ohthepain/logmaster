import { useEffect, useId, useRef } from 'react'
import { cn } from '../lib/cn'

/** Scroll only the strip when selection changes; never move the page vertically. */
export function ScrollingTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  panelId,
}: {
  label: string
  tabs: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  panelId: string
}) {
  const strip = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    const container = strip.current
    const selected = container?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    )
    if (!container || !selected) return
    const bounds = container.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.left < bounds.left)
      container.scrollLeft -= bounds.left - item.left + 12
    else if (item.right > bounds.right)
      container.scrollLeft += item.right - bounds.right + 12
  }, [value])

  return (
    <div
      ref={strip}
      role="tablist"
      aria-label={label}
      className="flex min-w-0 gap-6 overflow-x-auto overscroll-x-contain border-b border-[var(--line)] px-3 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          id={`${id}-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-controls={panelId}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => {
            let next = index
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
            else if (event.key === 'ArrowLeft')
              next = (index - 1 + tabs.length) % tabs.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = tabs.length - 1
            else return
            event.preventDefault()
            onChange(tabs[next].value)
            strip.current
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus({ preventScroll: true })
          }}
          className={cn(
            'relative min-h-12 shrink-0 whitespace-nowrap border-0 bg-transparent px-0 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]',
            value === tab.value
              ? 'font-semibold text-[var(--sea-ink)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--brand)]'
              : 'font-medium text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
