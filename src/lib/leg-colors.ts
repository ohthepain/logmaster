/** Distinct leg track colors — readable on nautical basemaps. */
export const LEG_TRACK_COLORS = [
  '#7ec8e8',
  '#f4a261',
  '#2a9d8f',
  '#e76f51',
  '#cdb4db',
  '#ffd166',
  '#06d6a0',
  '#ff6b9d',
] as const

export function generateLegColor(sequence: number): string {
  return LEG_TRACK_COLORS[sequence % LEG_TRACK_COLORS.length]
}

/** Accept persisted leg colors; fall back to palette by sequence. */
export function resolveLegColor(
  color: string | null | undefined,
  sequence: number,
): string {
  if (color?.trim()) return color.trim()
  return generateLegColor(sequence)
}
