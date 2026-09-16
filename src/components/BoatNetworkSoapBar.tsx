import { Link } from '@tanstack/react-router'
import type {
  ConnectedBoatNetwork,
  BoatNetworkKey,
} from '../domain/asset-connections'
import { cn } from '../lib/cn'

const NETWORK_SOAP_BAR_CLASS: Record<BoatNetworkKey, string> = {
  nmea_2000: 'bg-[var(--brand)] text-white',
  seatal_kng: 'bg-blue-600 text-white dark:bg-blue-500',
  seatal_k1: 'bg-sky-700 text-white dark:bg-sky-600',
  ethernet: 'bg-zinc-500 text-white dark:bg-zinc-500',
}

type BoatNetworkSoapBarProps = {
  boatId: string
  network: ConnectedBoatNetwork
  className?: string
}

export function BoatNetworkSoapBar({
  boatId,
  network,
  className,
}: BoatNetworkSoapBarProps) {
  return (
    <Link
      to="/boats/$boatId"
      params={{ boatId }}
      search={{ tab: 'networks', network: network.networkKey }}
      aria-label={`View ${network.name} network`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-none no-underline',
        NETWORK_SOAP_BAR_CLASS[network.networkKey],
        className,
      )}
    >
      {network.name}
    </Link>
  )
}

export function BoatNetworkSoapBars({
  boatId,
  networks,
}: {
  boatId: string
  networks: ConnectedBoatNetwork[]
}) {
  if (networks.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {networks.map((network) => (
        <BoatNetworkSoapBar
          key={network.networkKey}
          boatId={boatId}
          network={network}
        />
      ))}
    </span>
  )
}
