import { describe, expect, it } from 'vitest'
import {
  maxContentOrder,
  nextContentOrder,
  sortContentBlocksByOrderDesc,
  withNoteOrder,
  withVoiceOrder,
} from './log-entry-content-order'

describe('log-entry-content-order', () => {
  it('sorts blocks by order descending with stable tie-break', () => {
    const sorted = sortContentBlocksByOrderDesc([
      { key: 'a', kind: 'note', order: 1 },
      { key: 'b', kind: 'photo', order: 3 },
      { key: 'c', kind: 'voice', order: 3 },
      { key: 'd', kind: 'photo', order: 2 },
    ])

    expect(sorted.map((block) => block.key)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('allocates the next order above existing content', () => {
    expect(
      nextContentOrder({
        media: [{ order: 2 }, { order: 5 }],
        noteOrder: 1,
        voiceOrder: null,
      }),
    ).toBe(6)
  })

  it('stores note and voice order in entry data', () => {
    expect(withNoteOrder({}, 4)).toEqual({ noteOrder: 4 })
    expect(withVoiceOrder({ noteOrder: 4 }, 7)).toEqual({
      noteOrder: 4,
      voiceOrder: 7,
    })
    expect(withNoteOrder({ noteOrder: 4 }, null)).toBeNull()
  })

  it('returns zero when no content has an order yet', () => {
    expect(maxContentOrder({ media: [{ order: 0 }] })).toBe(0)
  })
})
