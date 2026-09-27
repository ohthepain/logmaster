import { useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { signIn } from '../lib/auth-client'
import { normalizeEmailForCompare } from '../lib/invite-auth-search'

type ExpiredInviteContinueProps = {
  email?: string | null
}

export function ExpiredInviteContinue({ email }: ExpiredInviteContinueProps) {
  const [value, setValue] = useState(email ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const address = value.trim()
    if (!address) return
    if (
      email &&
      normalizeEmailForCompare(address) !== normalizeEmailForCompare(email)
    ) {
      toast.error(`Use ${email}, the address this invite was sent to.`)
      return
    }
    setBusy(true)
    try {
      const result = await signIn.magicLink({
        email: address,
        callbackURL: '/',
      })
      if (result.error) {
        toast.error(result.error.message ?? 'Could not send the link')
        return
      }
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 text-left"
    >
      <p className="text-sm leading-6 text-[var(--sea-ink-soft)]">
        This invite has expired. We can email you a link to verify your address
        or create an account. You will still need a new invite to join.
      </p>
      <label className="block text-sm font-medium text-[var(--sea-ink)]">
        Email
        <input
          type="email"
          required
          value={value}
          onChange={(event) => {
            setSent(false)
            setValue(event.target.value)
          }}
          autoComplete="email"
          className="mt-1.5 block w-full rounded-xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex rounded-xl bg-[var(--btn-bg)] px-4 py-3 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Email me a link'}
      </button>
      {sent ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Check your inbox. The link signs you in, or creates your account if
          you do not have one yet.
        </p>
      ) : null}
    </form>
  )
}
