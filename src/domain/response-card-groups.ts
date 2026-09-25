import type { ChatMessage } from './messaging'

export function isResponseCardMessage(message: ChatMessage) {
  return (
    message.responseCard?.type === 'image-response' &&
    'card' in message.responseCard &&
    !message.boatActivity &&
    !message.logEntry &&
    !message.economyEvent
  )
}

/** Only adjacent cards join; other messages and a gap of a minute end the row. */
export function groupResponseCardMessages(
  messages: ChatMessage[],
): ChatMessage[][] {
  const groups: ChatMessage[][] = []
  for (const message of messages) {
    const previous = groups.at(-1)?.at(-1)
    const gap = previous
      ? Date.parse(message.createdAt) - Date.parse(previous.createdAt)
      : NaN
    if (
      previous &&
      isResponseCardMessage(previous) &&
      isResponseCardMessage(message) &&
      !previous.media?.length &&
      !message.media?.length &&
      previous.senderId === message.senderId &&
      previous.threadId === message.threadId &&
      gap >= 0 &&
      gap < 60_000
    )
      groups[groups.length - 1].push(message)
    else groups.push([message])
  }
  return groups
}
