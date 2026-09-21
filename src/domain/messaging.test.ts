import { describe, expect, it } from 'vitest'
import { referenceObjects, threadTimeGroup } from './messaging'
import type { ChatObject } from './messaging'

const boat: ChatObject = {
  kind: 'boat',
  id: 'boat-1',
  name: 'Cajola',
  href: '/boats/boat-1',
  image: null,
}
describe('object references', () => {
  it('capitalizes whole names and records exact display offsets', () => {
    const result = referenceObjects('Meet on cajola, then CAJOLA!', [boat])
    expect(result.text).toBe('Meet on Cajola, then Cajola!')
    expect(
      result.references.map((r) => result.text.slice(r.start, r.end)),
    ).toEqual(['Cajola', 'Cajola'])
  })
  it('does not link parts of words, URLs, emails, or ambiguous names', () => {
    expect(
      referenceObjects(
        'cajolas https://example.org/cajola cajola@example.org',
        [boat],
      ).references,
    ).toEqual([])
    expect(
      referenceObjects('Cajola', [boat, { ...boat, id: 'another' }]).references,
    ).toEqual([])
  })
  it('handles Unicode, regex punctuation, and overlapping names', () => {
    const object = { ...boat, name: 'Åsa (II)' }
    const result = referenceObjects('åsa (ii) / cajola blue / cajola', [
      boat,
      { ...boat, id: 'blue', name: 'Cajola Blue' },
      object,
    ])
    expect(result.references.map((r) => r.name)).toEqual([
      'Åsa (II)',
      'Cajola Blue',
      'Cajola',
    ])
  })
})
it('groups conversations by local calendar days', () => {
  const now = new Date(2026, 8, 21, 0, 10)
  expect(
    threadTimeGroup(new Date(2026, 8, 20, 23, 59).toISOString(), now),
  ).toBe('Yesterday')
  expect(threadTimeGroup(null, now)).toBe('No messages yet')
})

it('handles names after newlines and tabs without mistaking them for a preceding URL', () => {
  expect(
    referenceObjects('https://example.org\ncajola\tCajola', [boat]).references,
  ).toHaveLength(2)
})
