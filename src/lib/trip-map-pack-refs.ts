/** Pack ids that reference one stored tile. Shared tiles stay until the last pack is gone. */

export function packIdsAfterAttach(
  packIds: readonly string[] | undefined,
  packId: string,
): string[] {
  if (!packIds?.length) return [packId]
  if (packIds.includes(packId)) return [...packIds]
  return [...packIds, packId]
}

export function packIdsAfterDetach(
  packIds: readonly string[],
  packId: string,
): string[] {
  return packIds.filter((id) => id !== packId)
}
