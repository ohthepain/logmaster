import { Link } from '@tanstack/react-router'
import { DevComponentLabel } from './DevComponentLabel'

export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <>
      <DevComponentLabel name="LegalFooter" className="mx-auto mb-2" />
      <p
        className={`text-center text-xs text-[var(--sea-ink-soft)] ${className}`.trim()}
      >
      <Link
        to="/terms"
        className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
      >
        Terms of Service
      </Link>
      <span aria-hidden="true" className="mx-2">
        ·
      </span>
      <Link
        to="/privacy"
        className="underline underline-offset-2 hover:text-[var(--sea-ink)]"
      >
        Privacy Policy
      </Link>
    </p>
    </>
  )
}
