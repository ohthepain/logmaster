/**
 * True unless this browser explicitly reports itself offline.
 * Node exposes `navigator` with `onLine === undefined`, which must not count as offline.
 */
export function browserIsOnline() {
  if (typeof window === 'undefined') return true
  return navigator.onLine !== false
}
