import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/admin/jobs/geo-features')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/jobs', search: { tab: 'geo-features' } })
  },
})
