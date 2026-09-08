import { useEffect, useState  } from 'react'
import type {ComponentType} from 'react';
import { TripStoryPageShell } from './TripStoryPageShell'

export type TripStoryEditorProps = {
  tripId: string
  html: string
  onChange: (html: string) => void
  onSave: (html: string) => Promise<void>
  onResetFromTrip: () => void
  onCancel: () => void
}

export function TripStoryEditor(props: TripStoryEditorProps) {
  const [EditorImpl, setEditorImpl] =
    useState<ComponentType<TripStoryEditorProps> | null>(null)

  useEffect(() => {
    void import('./TripStoryEditorImpl').then((module) => {
      setEditorImpl(() => module.TripStoryEditorImpl)
    })
  }, [])

  if (!EditorImpl) {
    return (
      <TripStoryPageShell>
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading editor…</p>
        </div>
      </TripStoryPageShell>
    )
  }

  return <EditorImpl {...props} />
}
