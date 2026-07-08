import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/admin/')({
  component: AdminHome,
})

function AdminHome() {
  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="display-title mb-4 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Operations
        </h1>
        <p className="m-0 mb-6 max-w-2xl text-base leading-7 text-[var(--sea-ink-soft)]">
          Browse background job status and reference data. APIs live under{' '}
          <code className="rounded bg-[var(--chip-bg)] px-1.5 py-0.5 text-sm">
            /api/admin/…
          </code>
          .
        </p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <li>
            <Link
              to="/admin/pgboss"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              pg-boss jobs
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              queue stats and{' '}
              <code className="text-sm">build_geo_features</code> job history
            </span>
          </li>
          <li>
            <Link
              to="/admin/countries"
              className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
            >
              Countries
            </Link>
            <span className="text-[var(--sea-ink-soft)]"> — </span>
            <span className="text-[var(--sea-ink-soft)]">
              import GeoNames <code className="text-sm">countryInfo.txt</code> →{' '}
              <code className="text-sm">countries.json</code>
            </span>
          </li>
        </ul>
      </section>
    </main>
  )
}
