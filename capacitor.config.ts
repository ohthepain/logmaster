import type { CapacitorConfig } from '@capacitor/cli'

const devServerUrl = process.env.CAP_DEV_SERVER_URL?.trim()
const remoteAppUrl = process.env.VITE_PUBLIC_APP_URL?.trim()

const config: CapacitorConfig = {
  appId: 'live.logmaster.app',
  appName: 'logmaster',
  webDir: 'dist/client',
  android: {
    useLegacyBridge: true,
  },
  server: devServerUrl
    ? {
        url: devServerUrl,
        cleartext: devServerUrl.startsWith('http://'),
      }
    : remoteAppUrl
      ? {
          url: remoteAppUrl,
          cleartext: remoteAppUrl.startsWith('http://'),
        }
      : undefined,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
    },
  },
}

export default config
