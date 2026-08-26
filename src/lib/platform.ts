import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'web' | 'ios' | 'android' | 'native'

export function isNativePlatform() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

export function getNativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNativePlatform()) return 'web'
  return Capacitor.getPlatform() as 'ios' | 'android'
}

export function getAppPlatform(): AppPlatform {
  if (!isNativePlatform()) return 'web'
  const platform = Capacitor.getPlatform()
  if (platform === 'ios' || platform === 'android') return platform
  return 'native'
}

export function supportsBackgroundGps() {
  return getNativePlatform() === 'ios' || getNativePlatform() === 'android'
}

export function usesNativeAppleMap() {
  return getNativePlatform() === 'ios'
}
