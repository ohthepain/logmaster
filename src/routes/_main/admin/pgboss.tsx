import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/admin/pgboss')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/job-management' })
  },
})
