import { registerPlugin } from '@capacitor/core'
import type { LiveActivitySnapshot } from '../live-activity'
import { getNativePlatform } from '../platform'

type LiveActivityPlugin = {
  sync: (options: { state: LiveActivitySnapshot | null }) => Promise<{
    active: boolean
    supported: boolean
  }>
}

const NativeLiveActivity =
  registerPlugin<LiveActivityPlugin>('LogmasterLiveActivity')

export async function syncLiveActivity(
  state: LiveActivitySnapshot | null,
) {
  if (getNativePlatform() !== 'ios') {
    return { active: false, supported: false }
  }
  return NativeLiveActivity.sync({ state })
}
