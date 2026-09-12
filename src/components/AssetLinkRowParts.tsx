import { toast } from 'sonner'
import {
  assetLinkKindFromUrl,
  assetLinkKindLabel,
  assetLinkKindTagClass,
} from '../lib/asset-link-kind'
import { cn } from '../lib/cn'
import { isNativePlatform } from '../lib/platform'
import { normalizeExternalUrl, openExternalUrl } from '../lib/open-external-url'

export function AssetLinkTypeTag({ url }: { url: string }) {
  const kind = assetLinkKindFromUrl(url)
  return (
    <span
      className={cn(
        'shrink-0 self-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none',
        assetLinkKindTagClass[kind],
      )}
    >
      {assetLinkKindLabel[kind]}
    </span>
  )
}

export function AssetLinkTitle({ url, title }: { url: string; title: string }) {
  const href = normalizeExternalUrl(url)
  if (!href) {
    return (
      <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--sea-ink-soft)]">
        {title}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[var(--sea-ink)] underline"
      onClick={(event) => {
        if (!isNativePlatform()) return
        event.preventDefault()
        void openExternalUrl(href).then((ok) => {
          if (!ok) toast.error('Could not open link')
        })
      }}
    >
      {title}
    </a>
  )
}

export async function copyAssetLinkUrl(
  url: string,
  labels: { copied: string; failed: string },
) {
  const href = normalizeExternalUrl(url)
  if (!href) {
    toast.error(labels.failed)
    return
  }
  try {
    await navigator.clipboard.writeText(href)
    toast.success(labels.copied)
  } catch {
    toast.error(labels.failed)
  }
}
