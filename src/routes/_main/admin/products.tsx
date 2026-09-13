import { createFileRoute } from '@tanstack/react-router'
import { useIsAdmin } from '../../../lib/use-admin'
import { SharedAssetAdmin } from '../../../components/SharedAssetAdmin'

export const Route = createFileRoute('/_main/admin/products')({
  component: ProductAdmin,
})
function ProductAdmin() {
  const { isAdmin, loading } = useIsAdmin()
  if (loading) return <main className="page-wrap p-6">Loading…</main>
  if (!isAdmin)
    return <main className="page-wrap p-6">Admin access required.</main>
  return <SharedAssetAdmin />
}
