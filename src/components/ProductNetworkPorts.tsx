import { productNetworkLabel } from '../domain/product-networks'
import type { ProductNetworkConnection } from '../domain/product-networks'

export function ProductNetworkPorts({
  connections,
  label,
}: {
  connections: ProductNetworkConnection[]
  label: string
}) {
  if (!connections.length) return null
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
        {label}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {connections.map((item) => (
          <li
            key={item.networkKey}
            className="rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold"
          >
            {productNetworkLabel(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}
