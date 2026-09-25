import { expect, it } from 'vitest'
import { groupResponseCardMessages } from './response-card-groups'
import type { ChatMessage } from './messaging'

const card = (
  id: string,
  seconds: number,
  senderId = 'sender',
): ChatMessage => ({
  id,
  threadId: 'boat:boat',
  senderId,
  senderName: 'Alice',
  text: '',
  references: [],
  createdAt: new Date(1_000_000 + seconds * 1000).toISOString(),
  responseCard: {
    type: 'image-response',
    version: 1,
    card: { id: 'card', title: 'OK', enabled: true, checksum: '' },
  },
})
const ids = (messages: ChatMessage[]) =>
  groupResponseCardMessages(messages).map((group) =>
    group.map((message) => message.id),
  )
it('joins adjacent same-sender cards in chronological order using gaps under a minute', () => {
  expect(
    ids([card('a', 0), card('b', 59), card('c', 118), card('d', 178)]),
  ).toEqual([['a', 'b', 'c'], ['d']])
})
it('never crosses another sender, thread, regular message, media or backwards time', () => {
  expect(ids([card('a', 0), card('b', 1, 'other'), card('c', 2)])).toEqual([
    ['a'],
    ['b'],
    ['c'],
  ])
  for (const middle of [
    { ...card('b', 1), text: 'Hi', responseCard: null },
    { ...card('b', 1), threadId: 'boat:other' },
    { ...card('b', 1), media: [{ id: 'media' }] } as ChatMessage,
  ])
    expect(ids([card('a', 0), middle, card('c', 2)])).toEqual([
      ['a'],
      ['b'],
      ['c'],
    ])
  expect(ids([card('a', 1), card('b', 0)])).toEqual([['a'], ['b']])
})
