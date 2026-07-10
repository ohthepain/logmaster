const FTUE_STORAGE_KEY = 'logmaster:ftue-completed'

export function isFtueCompletedLocally(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(FTUE_STORAGE_KEY) === '1'
}

export function markFtueCompletedLocally(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FTUE_STORAGE_KEY, '1')
}

export function clearFtueCompletedLocally(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(FTUE_STORAGE_KEY)
}
