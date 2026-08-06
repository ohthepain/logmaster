export function realNowIso(): string {
  return new Date().toISOString()
}

export function advanceIso(iso: string, deltaMs: number): string {
  const baseMs = Date.parse(iso)
  if (Number.isNaN(baseMs)) return realNowIso()
  return new Date(baseMs + deltaMs).toISOString()
}

export function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datetimeLocalValueToIso(value: string): string | null {
  if (!value.trim()) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}
