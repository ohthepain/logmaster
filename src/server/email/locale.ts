import type { InviteLocale } from '../../lib/invite-locale'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { prisma } from '../db'

const db = prisma as any

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type ResolveEmailLocaleInput = {
  /** Explicit locale from invite, magic-link metadata, etc. */
  explicit?: unknown
  /** User's stored preferredLanguage when already loaded. */
  preferredLanguage?: string | null
  /** Lookup preferredLanguage by email when not provided. */
  email?: string | null
}

export function resolveEmailLocaleFromValues(
  input: ResolveEmailLocaleInput,
): InviteLocale | null {
  if (
    input.explicit !== undefined &&
    input.explicit !== null &&
    String(input.explicit).trim()
  ) {
    return normalizeInviteLocale(input.explicit)
  }

  if (input.preferredLanguage?.trim()) {
    return normalizeInviteLocale(input.preferredLanguage)
  }

  return null
}

export async function resolveEmailLocale(
  input: ResolveEmailLocaleInput,
): Promise<InviteLocale> {
  const fromValues = resolveEmailLocaleFromValues(input)
  if (fromValues) return fromValues

  const email = input.email?.trim()
  if (!email) return 'en'

  const user = await db.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { preferredLanguage: true },
  })
  if (user?.preferredLanguage) {
    return normalizeInviteLocale(user.preferredLanguage)
  }

  return 'en'
}
