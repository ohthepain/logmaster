import { describe, expect, it } from 'vitest'
import { renderActivityNotification } from './activity-message'

describe('renderActivityNotification', () => {
  it('localizes boat section notifications per locale', () => {
    const localization = {
      kind: 'resourceSection' as const,
      topic: 'BOAT_PHOTOS' as const,
      resourceName: 'Blue Horizon',
      actorName: 'Anna',
      action: { key: 'uploadedPhoto' as const },
    }
    const sv = renderActivityNotification(localization, 'sv')
    expect(sv.title).toContain('Blue Horizon')
    expect(sv.title).toContain('foton')
    expect(sv.body).toContain('Anna')
    expect(sv.body).toContain('foto')
  })

  it('localizes actions for Danish', () => {
    const da = renderActivityNotification(
      {
        kind: 'resourceSection',
        topic: 'BOAT_DOCUMENTS',
        resourceName: 'Nordic',
        actorName: 'Lars',
        action: { key: 'uploadedDocument' },
      },
      'da',
    )
    expect(da.body).toContain('Lars')
    expect(da.body).toContain('dokument')
    expect(da.title).toContain('dokumenter')
  })

  it('localizes trip completed notifications', () => {
    const de = renderActivityNotification(
      {
        kind: 'tripCompleted',
        boatName: 'Sea Breeze',
        tripTitle: 'Archipelago run',
        actorName: 'Kai',
      },
      'de',
    )
    expect(de.title).toContain('Sea Breeze')
    expect(de.body).toContain('Archipelago run')
  })
})
