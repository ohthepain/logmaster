export type ConnectionPerson = {
  id: string
  name: string
  image: string | null
  contexts: string[]
  connectionStatus: string | null
  incoming: boolean
}

/** A registered account available for a particular trip's roster. */
export type TripCrewUser = {
  id: string
  name: string
  imageUrl: string | null
}
