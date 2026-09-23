import { apiJson } from './api-client'
import type { ConnectionPerson, TripCrewUser } from '../domain/connections'

export async function fetchConnections() {
  return (await apiJson<{ people: ConnectionPerson[] }>('/api/connections'))
    .people
}
export async function fetchTripPeople(
  tripId?: string,
): Promise<TripCrewUser[]> {
  const { people } = await apiJson<{ people: ConnectionPerson[] }>(
    `/api/connections/crew-candidates${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ''}`,
  )
  return people.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl:
      p.image === '/api/profile/photo'
        ? `/api/crew/users/${p.id}/photo`
        : p.image,
  }))
}
export async function connectionAction(
  peerId: string,
  action: 'request' | 'accept' | 'decline' | 'remove' | 'cancel',
) {
  return apiJson(
    action === 'request'
      ? '/api/connections/request'
      : `/api/connections/${encodeURIComponent(peerId)}/${action}`,
    {
      method: 'POST',
      ...(action === 'request'
        ? { body: JSON.stringify({ userId: peerId }) }
        : {}),
    },
  )
}
export async function openPrivateChat(peerId: string) {
  return apiJson<{ threadId: string }>('/api/messaging/direct', {
    method: 'POST',
    body: JSON.stringify({ userId: peerId }),
  })
}
