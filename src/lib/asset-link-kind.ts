export type AssetLinkKind = 'pdf' | 'excel' | 'word' | 'image' | 'text' | 'web'

function extensionFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const cleaned = path.split('/').pop()?.split('?')[0]?.split('#')[0] ?? path
    const match = cleaned.match(/\.([a-z0-9]{1,8})$/i)
    return match?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export function assetLinkKindFromUrl(url: string): AssetLinkKind {
  const ext = extensionFromUrl(url)
  if (!ext) return 'web'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
    return 'image'
  }
  if (['txt', 'md'].includes(ext)) return 'text'
  if (['htm', 'html', 'php', 'asp', 'aspx'].includes(ext)) return 'web'
  return 'web'
}

/** GitHub-style label chips (soft fill + border). */
export const assetLinkKindTagClass: Record<AssetLinkKind, string> = {
  pdf: 'border-red-300/80 bg-red-500/12 text-red-800 dark:border-red-400/35 dark:bg-red-500/18 dark:text-red-200',
  excel:
    'border-emerald-300/80 bg-emerald-500/12 text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/18 dark:text-emerald-100',
  word: 'border-blue-300/80 bg-blue-500/12 text-blue-900 dark:border-blue-400/35 dark:bg-blue-500/18 dark:text-blue-100',
  image:
    'border-violet-300/80 bg-violet-500/12 text-violet-900 dark:border-violet-400/35 dark:bg-violet-500/18 dark:text-violet-100',
  text: 'border-neutral-300/80 bg-neutral-500/10 text-neutral-700 dark:border-neutral-500/40 dark:bg-neutral-500/15 dark:text-neutral-200',
  web: 'border-sky-300/80 bg-sky-500/12 text-sky-900 dark:border-sky-400/35 dark:bg-sky-500/18 dark:text-sky-100',
}

export const assetLinkKindLabel: Record<AssetLinkKind, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  word: 'Word',
  image: 'Image',
  text: 'Text',
  web: 'Link',
}
