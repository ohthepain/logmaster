import { cn } from '../lib/cn'
import { isDevModeAvailable } from '../lib/dev-mode'
import { useAppOptionsStore } from '../stores/app-options'

export default function DevModeToggle() {
  const devMode = useAppOptionsStore((state) => state.devMode)
  const setDevMode = useAppOptionsStore((state) => state.setDevMode)

  if (!isDevModeAvailable()) return null

  return (
    <button
      type="button"
      onClick={() => setDevMode(!devMode)}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] transition',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]',
        devMode
          ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
          : 'border-[var(--chip-line)] bg-transparent text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:text-[var(--sea-ink)]',
      )}
      aria-pressed={devMode}
      aria-label={devMode ? 'Disable dev mode' : 'Enable dev mode'}
      title={devMode ? 'Dev mode on' : 'Dev mode off'}
    >
      DEV
    </button>
  )
}
