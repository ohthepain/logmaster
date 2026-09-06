import { cn } from '../lib/cn'

type TripStoryViewProps = {
  html: string
  className?: string
}

export function TripStoryView({ html, className }: TripStoryViewProps) {
  if (!html.trim()) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        This story is empty. Add content in the editor.
      </p>
    )
  }

  return (
    <article
      className={cn('trip-story-view mx-auto w-full max-w-3xl', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
