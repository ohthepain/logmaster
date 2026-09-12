import { Languages } from 'lucide-react'
import { languages, useTranslation } from '../lib/i18n'
import { cn } from '../lib/cn'

export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, t } = useTranslation()
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm font-medium text-[var(--sea-ink)]', className)}>
      <Languages className="size-4" aria-hidden />
      <span>{t('language')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
        className="rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-2 py-1 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
        aria-label={t('language')}
      >
        {languages.map(({ code, nameKey }) => (
          <option key={code} value={code}>
            {t(nameKey)}
          </option>
        ))}
      </select>
    </label>
  )
}
