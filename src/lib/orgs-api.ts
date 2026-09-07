import type {
  Org,
  OrgContact,
  OrgContactDetail,
  OrgMember,
  OrgMemberRole,
  OrgPhoto,
} from '../domain/org'
import type { Boat } from '../domain/boat'
import type {
  InviteMemberResult,
  MemberInvite,
} from '../domain/member-invite'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error ?? text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchOrgs(): Promise<Org[]> {
  const data = await api<{ orgs: Org[] }>('/api/orgs')
  return data.orgs
}

export async function fetchOrg(orgId: string): Promise<Org> {
  const data = await api<{ org: Org }>(`/api/orgs/${orgId}`)
  return data.org
}

export async function createOrg(name: string): Promise<Org> {
  const data = await api<{ org: Org }>('/api/orgs', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  return data.org
}

export async function updateOrg(
  orgId: string,
  patch: { name: string },
): Promise<Org> {
  const data = await api<{ org: Org }>(`/api/orgs/${orgId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.org
}

export async function fetchOrgMembers(orgId: string): Promise<{
  members: OrgMember[]
  pendingInvites: MemberInvite[]
}> {
  const data = await api<{
    members: OrgMember[]
    pendingInvites: MemberInvite[]
  }>(`/api/orgs/${orgId}/members`)
  return data
}

export async function inviteOrgMember(
  orgId: string,
  input: { email: string; role?: OrgMemberRole; sendEmail?: boolean },
): Promise<InviteMemberResult> {
  return api<InviteMemberResult>(`/api/orgs/${orgId}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createOrgInviteLink(
  orgId: string,
  role: OrgMemberRole = 'MEMBER',
): Promise<MemberInvite> {
  const data = await api<{ invite: MemberInvite }>(
    `/api/orgs/${orgId}/invite-link`,
    { method: 'POST', body: JSON.stringify({ role }) },
  )
  return data.invite
}

export async function cancelOrgInvite(
  orgId: string,
  inviteId: string,
): Promise<void> {
  await api(`/api/orgs/${orgId}/invites/${inviteId}`, { method: 'DELETE' })
}

export async function updateOrgMemberRole(
  orgId: string,
  memberUserId: string,
  role: OrgMemberRole,
): Promise<OrgMember> {
  const data = await api<{ member: OrgMember }>(
    `/api/orgs/${orgId}/members/${memberUserId}`,
    { method: 'PATCH', body: JSON.stringify({ role }) },
  )
  return data.member
}

export async function removeOrgMember(
  orgId: string,
  memberUserId: string,
): Promise<void> {
  await api(`/api/orgs/${orgId}/members/${memberUserId}`, { method: 'DELETE' })
}

export async function fetchOrgContactDetail(
  orgId: string,
  contactId: string,
): Promise<OrgContactDetail> {
  return api<OrgContactDetail>(`/api/orgs/${orgId}/contacts/${contactId}`)
}

export async function updateOrgContact(
  orgId: string,
  contactId: string,
  patch: {
    displayName?: string
    email?: string | null
    phone?: string | null
    whatsapp?: string | null
    notes?: string | null
  },
): Promise<OrgContact> {
  const data = await api<{ contact: OrgContact }>(
    `/api/orgs/${orgId}/contacts/${contactId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  return data.contact
}

export async function addOrgContactMembership(
  orgId: string,
  contactId: string,
  input: { role?: OrgMemberRole; sendEmail?: boolean },
): Promise<{ member: OrgMember } | { invite: MemberInvite }> {
  return api(`/api/orgs/${orgId}/contacts/${contactId}/membership`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchOrgContacts(orgId: string): Promise<OrgContact[]> {
  const data = await api<{ contacts: OrgContact[] }>(
    `/api/orgs/${orgId}/contacts`,
  )
  return data.contacts
}

export async function createOrgContact(
  orgId: string,
  input: {
    displayName: string
    email?: string
    phone?: string
    whatsapp?: string
    notes?: string
  },
): Promise<OrgContact> {
  const data = await api<{ contact: OrgContact }>(`/api/orgs/${orgId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.contact
}

export async function deleteOrgContact(
  orgId: string,
  contactId: string,
): Promise<void> {
  await api(`/api/orgs/${orgId}/contacts/${contactId}`, { method: 'DELETE' })
}

export async function attachBoatToOrg(
  orgId: string,
  boatId: string,
): Promise<{ id: string; name: string }> {
  const data = await api<{ boat: { id: string; name: string } }>(
    `/api/orgs/${orgId}/boats`,
    { method: 'POST', body: JSON.stringify({ boatId }) },
  )
  return data.boat
}

export async function fetchOrgBoats(orgId: string): Promise<{
  boats: Boat[]
  canManageBoats: boolean
}> {
  return api<{ boats: Boat[]; canManageBoats: boolean }>(
    `/api/orgs/${orgId}/boats`,
  )
}

export async function uploadOrgPhoto(orgId: string, file: File): Promise<OrgPhoto> {
  const form = new FormData()
  form.append('file', file)
  const data = await api<{ photo: OrgPhoto }>(`/api/orgs/${orgId}/photos`, {
    method: 'POST',
    body: form,
  })
  return data.photo
}

export async function deleteOrgPhoto(photoId: string): Promise<void> {
  await api(`/api/orgs/photos/${photoId}`, { method: 'DELETE' })
}
