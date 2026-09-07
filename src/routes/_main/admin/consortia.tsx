import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/admin/consortia')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/orgs' })
  },
})
