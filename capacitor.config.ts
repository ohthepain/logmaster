import type { CapacitorConfig } from '@capacitor/cli'

/** Remote web app loaded in the native WebView (not bundled — see scripts/prepare-capacitor.mjs). */
export const CAPACITOR_STAGING_URL = 'https://staging.logmaster.live'
export const CAPACITOR_PRODUCTION_URL = 'https://logmaster.live'

const devServerUrl = process.env.CAP_DEV_SERVER_URL?.trim()
const remoteAppUrl =
  process.env.CAP_REMOTE_APP_URL?.trim() ||
  process.env.VITE_PUBLIC_APP_URL?.trim() ||
  CAPACITOR_PRODUCTION_URL

const config: CapacitorConfig = {
  appId: 'live.logmaster.app',
  appName: 'Logbook2.0',
  webDir: 'dist/client',
  android: {
    useLegacyBridge: true,
  },
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: devServerUrl.startsWith('http://'),
      }
    : {
        url: remoteAppUrl,
        cleartext: remoteAppUrl.startsWith('http://'),
      },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
    },
  },
}

export default config
