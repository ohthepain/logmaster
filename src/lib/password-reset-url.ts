/** Build the Better Auth callback URL used in password-reset emails. */
export function passwordResetCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/reset-password`
}

/** Email link: hits the auth API, which validates the token and redirects to the app. */
export function passwordResetEmailUrl(args: {
  origin: string
  token: string
  redirectTo?: string
}): string {
  const origin = args.origin.replace(/\/$/, '')
  const redirectTo = args.redirectTo ?? passwordResetCallbackUrl(origin)
  return `${origin}/api/auth/reset-password/${args.token}?callbackURL=${encodeURIComponent(redirectTo)}`
}
