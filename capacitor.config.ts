import type { CapacitorConfig } from '@capacitor/cli'

const DEFAULT_PRODUCTION_URL = 'https://logmaster.live'
const devServerUrl = process.env.CAP_DEV_SERVER_URL?.trim()
const remoteAppUrl =
  process.env.VITE_PUBLIC_APP_URL?.trim() || DEFAULT_PRODUCTION_URL

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
