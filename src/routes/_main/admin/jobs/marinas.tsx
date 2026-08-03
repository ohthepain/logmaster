import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/admin/jobs/marinas')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/jobs', search: { tab: 'marinas' } })
  },
})
