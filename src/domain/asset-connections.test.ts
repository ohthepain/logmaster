import { describe, expect, it } from 'vitest'
import { validateAssetConnection } from './asset-connections'

const equipment = (id: string) => ({
  id,
  kind: 'equipment' as const,
  boatId: 'boat',
})

const network = (id: string) => ({
  id,
  kind: 'system_network' as const,
  boatId: 'boat',
})

describe('validateAssetConnection', () => {
  it('allows cable between equipment and a network', () => {
    expect(
      validateAssetConnection('cable', equipment('a'), network('n')),
    ).toBeNull()
  })
  it('rejects wifi to a network', () => {
    expect(
      validateAssetConnection('wifi', equipment('a'), network('n')),
    ).toMatch(/Wi‑Fi/)
  })
  it('rejects two networks', () => {
    expect(
      validateAssetConnection('cable', network('n1'), network('n2')),
    ).toMatch(/Networks cannot/)
  })
})
