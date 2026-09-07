export function documentTitleFromFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (!trimmed) return 'Document'
  const withoutExt = trimmed.replace(/\.[^.]+$/, '')
  return withoutExt.trim() || trimmed
}

function humanizeSegment(value: string): string {
  return value
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function documentTitleFromUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const path = parsed.pathname.replace(/\/+$/, '')
    const segment = path.split('/').filter(Boolean).pop()
    if (segment) {
      const decoded = decodeURIComponent(segment)
      const withoutExt = decoded.replace(/\.[^.]+$/, '')
      const humanized = humanizeSegment(withoutExt)
      if (humanized) return humanized
    }

    const host = parsed.hostname.replace(/^www\./i, '')
    return host || null
  } catch {
    return null
  }
}

export function resolveDocumentLinkTitle(
  url: string,
  options: { title?: string | null; pageTitle?: string | null } = {},
): string {
  const manualTitle = options.title?.trim()
  if (manualTitle) return manualTitle

  const pageTitle = options.pageTitle?.trim()
  if (pageTitle) return pageTitle

  return documentTitleFromUrl(url) ?? url.trim()
}
