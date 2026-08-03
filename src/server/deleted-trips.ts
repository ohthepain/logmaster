import { prisma } from './db'

const db = prisma as any

export async function getDeletedTripIds(): Promise<string[]> {
  const rows = await db.deletedTrip.findMany({
    select: { id: true },
    orderBy: { deletedAt: 'desc' },
  })
  return rows.map((row: { id: string }) => row.id)
}

export async function recordDeletedTrips(tripIds: string[]) {
  const unique = [...new Set(tripIds.filter(Boolean))]
  if (unique.length === 0) return

  await prisma.$transaction(
    unique.map((id) =>
      db.deletedTrip.upsert({
        where: { id },
        create: { id },
        update: {},
      }),
    ),
  )
}

export async function deleteTripsFromLogbook(tripIds: string[]) {
  const unique = [...new Set(tripIds.filter(Boolean))]
  if (unique.length === 0) return 0

  await recordDeletedTrips(unique)
  const result = await db.trip.deleteMany({
    where: { id: { in: unique } },
  })
  return result.count
}
