import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsPage } from '../../../components/ConnectionsPage'

export const Route = createFileRoute('/_main/connections/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { add?: boolean; userId?: string } => ({
    add: search.add === true || search.add === 'true',
    userId: typeof search.userId === 'string' ? search.userId : undefined,
  }),
  component: Page,
})
function Page() {
  return <ConnectionsPage add={Route.useSearch().add} />
}
