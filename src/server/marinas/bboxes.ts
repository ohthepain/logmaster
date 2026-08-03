export type MarinaBbox = {
  west: number
  south: number
  east: number
  north: number
}

/** Continental US, Canada, Mexico, Caribbean coasts, Alaska. */
export const NORTH_AMERICA_MARINA_BBOX: MarinaBbox = {
  west: -170,
  south: 15,
  east: -50,
  north: 72,
}

/** Smaller bbox for quick local testing (most of Canada + Great Lakes). */
export const CANADA_MARINA_BBOX: MarinaBbox = {
  west: -141,
  south: 42,
  east: -52,
  north: 72,
}
