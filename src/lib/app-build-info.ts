import { App } from '@capacitor/app'
import { STAGING_HOST } from './dev-mode'
import { isNativePlatform } from './platform'

export type AppEnvironmentLabel = 'stage' | 'build'

/** `stage` when the WebView loads the staging deploy; `build` for production and local dev. */
export function getAppEnvironmentLabel(): AppEnvironmentLabel {
  if (typeof window === 'undefined') return 'build'
  return window.location.hostname === STAGING_HOST ? 'stage' : 'build'
}

/** iOS/Android shell build (CFBundleVersion / versionCode) — incremented on each native archive. */
export async function getNativeBuildNumber(): Promise<string | null> {
  if (!isNativePlatform()) return null
  try {
    const info = await App.getInfo()
    return info.build?.trim() || null
  } catch {
    return null
  }
}

export function formatAppBuildFooter(
  envLabel: AppEnvironmentLabel,
  buildNumber: string | null,
): string {
  return buildNumber ? `${envLabel} · ${buildNumber}` : envLabel
}
