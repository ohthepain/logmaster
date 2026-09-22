import { languages, useTranslation } from '../lib/i18n'
import type { InviteLocale } from '../lib/invite-locale'

type InviteLanguageSelectProps = {
  value: InviteLocale
  onChange: (locale: InviteLocale) => void
  disabled?: boolean
  id?: string
}

export function InviteLanguageSelect({
  value,
  onChange,
  disabled = false,
  id,
}: InviteLanguageSelectProps) {
  const { t } = useTranslation()
  const options = [...languages].sort((left, right) =>
    left.nativeName.localeCompare(right.nativeName, 'en'),
  )

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
        {t('inviteEmailLanguage')}
      </span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as InviteLocale)}
        className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20 disabled:opacity-60"
      >
        {options.map((item) => (
          <option key={item.code} value={item.code}>
            {item.flag} {item.nativeName}
          </option>
        ))}
      </select>
      <p className="m-0 mt-1.5 text-xs leading-5 text-[var(--sea-ink-soft)]">
        {t('inviteEmailLanguageHint')}
      </p>
    </label>
  )
}
