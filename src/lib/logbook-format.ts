import type { WeatherSnapshot } from '../domain/logbook'

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatPosition(
  latitude?: number | null,
  longitude?: number | null,
) {
  if (latitude == null || longitude == null) return 'Position unavailable'
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

export function formatWeather(weather: WeatherSnapshot) {
  const parts: string[] = []
  if (typeof weather.temperatureC === 'number') {
    parts.push(`${Math.round(weather.temperatureC)}°C`)
  }
  if (typeof weather.windKph === 'number') {
    parts.push(`${Math.round(weather.windKph)} km/h wind`)
  }
  if (typeof weather.cloudCoverPct === 'number') {
    parts.push(`${Math.round(weather.cloudCoverPct)}% cloud`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Weather available'
}
