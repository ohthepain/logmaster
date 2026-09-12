import type { TranslationKey, TranslationVars } from './i18n'

const PLAYBACK_FIELD_KEYS: Record<string, TranslationKey> = {
  time: 'fieldTime',
  position: 'fieldPosition',
  heading: 'fieldHeading',
  elevation: 'fieldElevation',
  sog: 'fieldSpeedOverGround',
  stw: 'fieldSpeedThroughWater',
  'water-temperature': 'fieldWaterTemperature',
  cog: 'fieldCourseOverGround',
  wind: 'fieldWind',
  depth: 'fieldDepth',
  engine: 'fieldEngine',
  battery: 'fieldBattery',
  'sog-derived': 'fieldSpeedOverGroundGps',
  'log-entries': 'logEntries',
  media: 'media',
  'gpx:hr': 'fieldHeartRate',
  'gpx:cad': 'fieldCadence',
  'gpx:atemp': 'fieldAmbientTemperature',
  'gpx:power': 'fieldPower',
  'gpx:distance': 'fieldDistance',
}

const PLAYBACK_SHORT_KEYS: Record<string, TranslationKey> = {
  'log-entries': 'logShort',
  media: 'media',
  'water-temperature': 'fieldWaterTemperature',
  wind: 'fieldWind',
}

export function translatePlaybackField(
  id: string,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
  fallback: string,
): string {
  const key = PLAYBACK_FIELD_KEYS[id]
  return key ? t(key) : fallback
}

export function translatePlaybackShortLabel(
  id: string,
  t: (key: TranslationKey, vars?: TranslationVars) => string,
  fallback: string,
): string {
  const key = PLAYBACK_SHORT_KEYS[id]
  return key ? t(key) : fallback
}
