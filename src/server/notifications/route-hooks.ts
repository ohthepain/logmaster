import { fireNotification, notifyBoatSection, notifyOrgSection } from '../notifications/events'

export function fireBoatPhotosNotification(
  userId: string,
  boat: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyBoatSection({
      topic: 'BOAT_PHOTOS',
      boatId: boat.id,
      boatName: boat.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireBoatDocumentsNotification(
  userId: string,
  boat: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyBoatSection({
      topic: 'BOAT_DOCUMENTS',
      boatId: boat.id,
      boatName: boat.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireBoatAssetsNotification(
  userId: string,
  boat: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyBoatSection({
      topic: 'BOAT_ASSETS',
      boatId: boat.id,
      boatName: boat.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireBoatMembersNotification(
  userId: string,
  boat: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyBoatSection({
      topic: 'BOAT_MEMBERS',
      boatId: boat.id,
      boatName: boat.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireBoatSharesNotification(
  userId: string,
  boat: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyBoatSection({
      topic: 'BOAT_SHARES',
      boatId: boat.id,
      boatName: boat.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireOrgMembersNotification(
  userId: string,
  org: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyOrgSection({
      topic: 'ORG_MEMBERS',
      orgId: org.id,
      orgName: org.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireOrgDocumentsNotification(
  userId: string,
  org: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyOrgSection({
      topic: 'ORG_DOCUMENTS',
      orgId: org.id,
      orgName: org.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireOrgContactsNotification(
  userId: string,
  org: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyOrgSection({
      topic: 'ORG_CONTACTS',
      orgId: org.id,
      orgName: org.name,
      actorUserId: userId,
      action,
    }),
  )
}

export function fireOrgBoatsNotification(
  userId: string,
  org: { id: string; name: string },
  action: string,
) {
  fireNotification(
    notifyOrgSection({
      topic: 'ORG_BOATS',
      orgId: org.id,
      orgName: org.name,
      actorUserId: userId,
      action,
    }),
  )
}
