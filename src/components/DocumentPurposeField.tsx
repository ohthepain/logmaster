import type { DocumentPurpose } from '../domain/boat-assets'
import { DOCUMENT_PURPOSE_LABELS } from '../domain/boat-assets'

const PURPOSE_OPTIONS: DocumentPurpose[] = [
  'receipt',
  'invoice',
  'photo',
  'manual',
  'warranty',
  'other',
]

type DocumentPurposeFieldProps = {
  value: DocumentPurpose | ''
  onChange: (value: DocumentPurpose | '') => void
  id?: string
}

export function DocumentPurposeField({
  value,
  onChange,
  id,
}: DocumentPurposeFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="font-semibold text-[var(--sea-ink)]">Purpose</span>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as DocumentPurpose | '')
        }
        className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-[var(--sea-ink)]"
      >
        <option value="">None</option>
        {PURPOSE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {DOCUMENT_PURPOSE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function DocumentPurposeBadge({
  purpose,
}: {
  purpose: DocumentPurpose | null
}) {
  if (!purpose) return null
  return (
    <span className="rounded-full bg-[var(--brand-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
      {DOCUMENT_PURPOSE_LABELS[purpose]}
    </span>
  )
}
