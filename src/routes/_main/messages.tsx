import { createFileRoute, Link } from '@tanstack/react-router'
import { Messaging } from '../../components/Messaging'
import { useSession } from '../../lib/auth-client'

export const Route = createFileRoute('/_main/messages')({
  validateSearch: (search: Record<string, unknown>): { thread?: string } => ({
    thread: typeof search.thread === 'string' ? search.thread : undefined,
  }),
  component: MessagesPage,
})
function MessagesPage() {
  const { data, isPending } = useSession()
  const { thread } = Route.useSearch()
  const navigate = Route.useNavigate()
  if (isPending) return <p className="page-wrap p-5">Loading…</p>
  if (!data?.user)
    return (
      <div className="page-wrap p-5">
        <Link to="/sign-in">Sign in to open your messages</Link>
      </div>
    )
  return (
    <Messaging
      key={data.user.id}
      userId={data.user.id}
      selectedId={thread}
      onSelect={(id) => {
        void navigate({ search: { thread: id }, replace: true })
      }}
      onBackFromInbox={() => {
        void navigate({ to: '/' })
      }}
    />
  )
}
