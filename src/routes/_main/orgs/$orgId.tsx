import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/orgs/$orgId')({
  component: OrgLayout,
})

function OrgLayout() {
  return <Outlet />
}
