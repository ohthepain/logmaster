/** Provider-neutral contracts. No Stream types may escape the adapters. */
export type ChatObjectKind = 'org' | 'boat' | 'trip' | 'asset' | 'user'
export type ChatObject = {
  kind: ChatObjectKind
  id: string
  name: string
  href: string
  image: string | null
}
export type ObjectReference = ChatObject & { start: number; end: number }
export type ResponseCard = {
  version: 1
  type: string
  object: Pick<ChatObject, 'kind' | 'id'>
  data: Record<string, unknown>
}
export type ChatMessage = {
  id: string
  threadId: string
  senderId: string
  senderName: string
  text: string
  references: ObjectReference[]
  responseCard: ResponseCard | null
  createdAt: string
}
export type MessageLikes = {
  messageId: string
  likeCount: number
  myLikeCount: number
}
export type ChatThread = {
  id: string
  object: ChatObject
  memberCount: number
  lastMessage: ChatMessage | null
  unreadCount: number
}
export type ChatSession =
  | {
      provider: 'stream'
      apiKey: string
      token: string
      userId: string
      channelType: string
      channelId: string
    }
  | { provider: 'polling'; userId: string }

/** Match whole names, prefer longest matches, and never guess ambiguous names. */
export function referenceObjects(text: string, objects: ChatObject[]) {
  const byName = new Map<string, ChatObject[]>()
  for (const object of objects) {
    const key = object.name.trim().toLocaleLowerCase()
    if (!key) continue
    const matches = byName.get(key) ?? []
    if (
      !matches.some(
        (item) => item.kind === object.kind && item.id === object.id,
      )
    )
      matches.push(object)
    byName.set(key, matches)
  }
  const candidates = [...byName.entries()]
    .filter(([, items]) => items.length === 1)
    .sort((a, b) => b[0].length - a[0].length)
  if (!candidates.length) return { text, references: [] as ObjectReference[] }
  const escaped = candidates.map(([name]) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${escaped.join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  )
  const references: ObjectReference[] = []
  let output = ''
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    // Don't rewrite a fragment of a URL or an email address.
    const tokenStart = text.slice(0, index).search(/\S*$/u)
    const token = text.slice(tokenStart).split(/\s/u)[0]
    if (token.includes('://') || token.includes('@')) continue
    const object = byName.get(match[0].toLocaleLowerCase())?.[0]
    if (!object) continue
    output += text.slice(cursor, index)
    const start = output.length
    output += object.name
    references.push({ ...object, start, end: output.length })
    cursor = index + match[0].length
  }
  return { text: output + text.slice(cursor), references }
}

export function threadTimeGroup(date: string | null, now = new Date()): string {
  if (!date) return 'No messages yet'
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const time = new Date(date).getTime()
  if (time >= day) return 'Today'
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).getTime()
  if (time >= yesterday) return 'Yesterday'
  if (time >= day - 6 * 86400000) return 'This week'
  return 'Earlier'
}
