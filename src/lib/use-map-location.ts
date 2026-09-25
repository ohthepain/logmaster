import { useCallback, useEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  checkLocationPermission,
  requestDevicePosition,
  subscribeToDevicePosition,
} from './device-position'
import type { LocationFailure } from './device-position'

export type MapLocationState =
  | 'idle'
  | 'checking'
  | 'permission'
  | 'requesting'
  | 'locating'
  | 'ready'
  | 'browsing'
  | LocationFailure

export function useMapLocation(enabled: boolean) {
  const [state, setState] = useState<MapLocationState>(
    enabled ? 'checking' : 'idle',
  )
  const generation = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const request = useCallback(async (permissionGranted = false) => {
    const run = ++generation.current
    setState(permissionGranted ? 'locating' : 'requesting')
    const result = await requestDevicePosition(() => {
      if (run === generation.current) setState('locating')
    })
    if (run !== generation.current) return
    setState(result.status === 'success' ? 'ready' : result.status)
  }, [])

  const check = useCallback(async () => {
    const run = ++generation.current
    setState('checking')
    const permission = await checkLocationPermission()
    if (run !== generation.current) return
    if (permission === 'granted') {
      void request(true)
    } else {
      setState(permission === 'prompt' ? 'permission' : permission)
    }
  }, [request])

  useEffect(() => {
    if (enabled) void check()
    else setState('idle')
    return () => {
      generation.current += 1
    }
  }, [enabled, check])

  useEffect(() => {
    // A recording or another map may deliver the first fix while this panel is open.
    return subscribeToDevicePosition(
      () => {
        if (stateRef.current === 'locating') {
          // A later timeout from our one-shot read must not cover a live fix.
          generation.current += 1
          stateRef.current = 'ready'
          setState('ready')
        }
      },
      { passive: true },
    )
  }, [])

  useEffect(() => {
    const resume = () => {
      if (['denied', 'unavailable', 'permission'].includes(stateRef.current))
        void check()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') resume()
    }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', visible)
    const listener = Capacitor.isNativePlatform()
      ? App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) resume()
        })
      : null
    return () => {
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', visible)
      void listener?.then((handle) => handle.remove())
    }
  }, [check])

  const browse = useCallback(() => {
    generation.current += 1
    setState('browsing')
  }, [])

  return { state, request, check, browse }
}
