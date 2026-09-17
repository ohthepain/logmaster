import { createFileRoute } from '@tanstack/react-router'
import { AdminCatalogCrawlRunDetail } from '../../../../components/admin/AdminCatalogCrawlRunDetail'
import { AdminPageShell } from '../../../../components/admin/AdminPageShell'

export const Route = createFileRoute('/_main/admin/catalog-crawls/$runId')({
  component: AdminCatalogCrawlRunPage,
})

function AdminCatalogCrawlRunPage() {
  const { runId } = Route.useParams()
  return (
    <AdminPageShell
      kicker="Admin · Product catalog"
      title="Crawl products"
      description="Products parsed from this crawl, and whether each source URL was imported into the catalog."
      backTo={{ to: '/admin/catalog-crawls', label: 'Catalog crawls' }}
    >
      <AdminCatalogCrawlRunDetail runId={runId} />
    </AdminPageShell>
  )
}
