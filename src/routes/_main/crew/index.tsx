import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/crew/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { addCrew?: boolean; userId?: string } => ({
    addCrew: Boolean(search.addCrew),
    userId: typeof search.userId === 'string' ? search.userId : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/connections',
      search: { add: search.addCrew, userId: search.userId },
    })
  },
})
