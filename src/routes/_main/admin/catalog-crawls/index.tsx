import { createFileRoute, Link } from '@tanstack/react-router'
import { AdminCatalogCrawlRunsPanel } from '../../../../components/admin/AdminCatalogCrawlRunsPanel'
import { AdminPageShell } from '../../../../components/admin/AdminPageShell'

export const Route = createFileRoute('/_main/admin/catalog-crawls/')({
  component: AdminCatalogCrawlsPage,
})

function AdminCatalogCrawlsPage() {
  return (
    <AdminPageShell
      kicker="Admin · Product catalog"
      title="Catalog crawls"
      description={
        <>
          Search stored CLI and worker crawls, then open, repeat, re-import, or
          delete them. Queue a new scrape from{' '}
          <Link
            to="/admin/jobs"
            search={{ tab: 'product-catalog-nauticexpo' }}
            className="text-[var(--sea-accent)] font-medium underline decoration-[var(--sea-accent)]/50 underline-offset-2 hover:decoration-[var(--sea-accent)]"
          >
            Product catalog crawls
          </Link>
          .
        </>
      }
    >
      <AdminCatalogCrawlRunsPanel />
    </AdminPageShell>
  )
}
