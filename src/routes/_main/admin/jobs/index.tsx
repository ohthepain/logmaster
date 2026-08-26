import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { AdminJobRunsPanel } from '../../../../components/admin/AdminJobRunsPanel'
import { AdminPageShell } from '../../../../components/admin/AdminPageShell'
import {
  ADMIN_JOB_CATALOG,
  BUILD_GEO_FEATURES_QUEUE,
  BUILD_MARINAS_QUEUE,
  BUILD_OSM_POINTS_QUEUE,
  formatGeoFeaturesRunInput,
  formatGeoFeaturesRunResult,
  formatMarinasRunInput,
  formatMarinasRunResult,
  formatOsmPointsRunInput,
  formatOsmPointsRunResult
  
} from '../../../../lib/admin-jobs'
import type {AdminJobCatalogId} from '../../../../lib/admin-jobs';

type JobsSearch = {
  tab?: AdminJobCatalogId
}

export const Route = createFileRoute('/_main/admin/jobs/')({
  validateSearch: (search: Record<string, unknown>): JobsSearch => {
    const tab = search.tab
    if (
      tab === 'geo-features' ||
      tab === 'marinas' ||
      tab === 'osm-points'
    ) {
      return { tab }
    }
    return {}
  },
  component: AdminJobsIndexPage,
})

function AdminJobsIndexPage() {
  const { tab: tabFromSearch } = Route.useSearch()
  const tab = tabFromSearch ?? 'geo-features'
  const navigate = useNavigate()

  const setTab = useCallback(
    (next: AdminJobCatalogId) => {
      void navigate({ to: '/admin/jobs', search: { tab: next } })
    },
    [navigate],
  )

  return (
    <AdminPageShell
      kicker="Background jobs"
      title="Map data builds"
      description="Monitor long-running map data imports by layer. Queue new builds from the region page."
    >
      <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
        Queue builds on{' '}
        <Link
          to="/admin/regions"
          className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
        >
          Build by region
        </Link>
        . View all runs on the{' '}
        <Link
          to="/admin/job-management"
          className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
        >
          Jobs
        </Link>{' '}
        page.
      </p>

      <div
        role="tablist"
        aria-label="Job types"
        className="mb-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
      >
        {ADMIN_JOB_CATALOG.map((job) => {
          const selected = tab === job.id
          return (
            <button
              key={job.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(job.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border border-[var(--btn-bg)] bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]'
              }`}
            >
              {job.title}
            </button>
          )
        })}
      </div>

      {tab === 'geo-features' ? (
        <div role="tabpanel" className="flex flex-col gap-8">
          <AdminJobRunsPanel
            queue={BUILD_GEO_FEATURES_QUEUE}
            formatInput={formatGeoFeaturesRunInput}
            formatResult={formatGeoFeaturesRunResult}
          />
        </div>
      ) : null}

      {tab === 'marinas' ? (
        <div role="tabpanel" className="flex flex-col gap-8">
          <AdminJobRunsPanel
            queue={BUILD_MARINAS_QUEUE}
            formatInput={formatMarinasRunInput}
            formatResult={formatMarinasRunResult}
          />
        </div>
      ) : null}

      {tab === 'osm-points' ? (
        <div role="tabpanel" className="flex flex-col gap-8">
          <AdminJobRunsPanel
            queue={BUILD_OSM_POINTS_QUEUE}
            formatInput={formatOsmPointsRunInput}
            formatResult={formatOsmPointsRunResult}
          />
        </div>
      ) : null}
    </AdminPageShell>
  )
}
