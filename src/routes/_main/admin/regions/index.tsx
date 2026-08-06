import { Link, createFileRoute } from '@tanstack/react-router'
import { AdminPageShell } from '../../../../components/admin/AdminPageShell'
import { AdminRegionBuildPanel } from '../../../../components/admin/AdminRegionBuildPanel'

export const Route = createFileRoute('/_main/admin/regions/')({
  component: AdminRegionsPage,
})

function AdminRegionsPage() {
  return (
    <AdminPageShell
      kicker="Background jobs"
      title="Build map data by region"
      description="Pick a geographic region, choose which layers to rebuild, then queue jobs. Use the job monitoring pages to track progress by layer type."
    >
      <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
        Monitor runs on{' '}
        <Link
          to="/admin/jobs"
          className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
        >
          Map data builds
        </Link>{' '}
        (by layer) or{' '}
        <Link
          to="/admin/job-management"
          className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
        >
          Jobs
        </Link>{' '}
        (all queues).
      </p>

      <AdminRegionBuildPanel />
    </AdminPageShell>
  )
}
