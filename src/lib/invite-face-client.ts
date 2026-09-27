import type { InviteFace } from '../domain/invite-face'
import { apiJson } from './api-client'
import { parseInviteFromRedirect } from './invite-auth-search'

export async function fetchInviteFace(
  redirectPath: string,
): Promise<InviteFace | null> {
  const invite = parseInviteFromRedirect(redirectPath)
  if (!invite) return null
  try {
    if (invite.kind === 'member') {
      const data = await apiJson<{ preview: { face?: InviteFace | null } }>(
        `/api/member-invites/preview/${encodeURIComponent(invite.token)}`,
      )
      return data.preview.face ?? null
    }
    if (invite.kind === 'crew') {
      const data = await apiJson<{ face?: InviteFace | null }>(
        `/api/crew/invites/preview/${encodeURIComponent(invite.token)}`,
      )
      return data.face ?? null
    }
    const data = await apiJson<{ face?: InviteFace | null }>(
      `/api/connections/invites/${encodeURIComponent(invite.token)}`,
    )
    return data.face ?? null
  } catch {
    return null
  }
}
