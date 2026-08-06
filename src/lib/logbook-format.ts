import type { WeatherSnapshot } from '../domain/logbook'

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

/** Start date+time; end time always; end date only when different from start. */
export function formatLegDateTimeRange(
  startedAt: string,
  endedAt?: string | null,
): string {
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return startedAt

  const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  })

  const startLabel = dateTimeFormatter.format(start)
  if (!endedAt) return startLabel

  const end = new Date(endedAt)
  if (Number.isNaN(end.getTime())) return startLabel

  if (sameCalendarDay(start, end)) {
    return `${startLabel} – ${timeFormatter.format(end)}`
  }

  return `${startLabel} – ${dateTimeFormatter.format(end)}`
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
