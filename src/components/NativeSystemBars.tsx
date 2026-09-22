import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { useEffect } from 'react'
import { isNativePlatform } from '../lib/platform'

function resolvedThemeIsDark() {
  return document.documentElement.classList.contains('dark')
}

/** Match status bar icon contrast to the active light/dark theme on native shells. */
export function NativeSystemBars() {
  useEffect(() => {
    if (!isNativePlatform()) return

    const sync = () => {
      void SystemBars.setStyle({
        style: resolvedThemeIsDark()
          ? SystemBarsStyle.Dark
          : SystemBarsStyle.Light,
      })
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return null
}
