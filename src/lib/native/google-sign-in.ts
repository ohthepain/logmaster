import { ErrorCode, GoogleSignIn } from '@capawesome/capacitor-google-sign-in'
import { signIn } from '../auth-client'
import { apiUrl } from '../app-origin'
import { isNativePlatform } from '../platform'

let initPromise: Promise<void> | null = null

async function ensureGoogleSignInInitialized() {
  if (!isNativePlatform()) return
  if (!initPromise) {
    initPromise = (async () => {
      const res = await fetch(apiUrl('/api/health'))
      if (!res.ok) {
        throw new Error('Could not load auth configuration')
      }
      const data = (await res.json()) as {
        googleSignIn?: boolean
        googleWebClientId?: string | null
      }
      if (!data.googleSignIn || !data.googleWebClientId) {
        throw new Error('Google sign-in is not configured on the server')
      }
      await GoogleSignIn.initialize({ clientId: data.googleWebClientId })
    })()
  }
  await initPromise
}

/** Native Google Sign-In (iOS/Android). Returns true when a session was created. */
export async function signInWithGoogleNative(callbackURL: string) {
  await ensureGoogleSignInInitialized()
  try {
    const result = await GoogleSignIn.signIn()
    if (!result.idToken) {
      throw new Error('Google did not return an ID token')
    }
    const authResult = await signIn.social({
      provider: 'google',
      callbackURL,
      idToken: {
        token: result.idToken,
        ...(result.accessToken ? { accessToken: result.accessToken } : {}),
      },
    })
    if (authResult.error) {
      throw new Error(authResult.error.message ?? 'Google sign in failed')
    }
    return true
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === ErrorCode.SignInCanceled) {
      return false
    }
    throw err
  }
}

export function supportsNativeGoogleSignIn() {
  return isNativePlatform()
}
