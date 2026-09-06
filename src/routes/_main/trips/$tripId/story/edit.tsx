import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Media } from '../../../../../domain/logbook'
import { TripStoryEditor } from '../../../../../components/TripStoryEditor'
import { TripStoryPageShell } from '../../../../../components/TripStoryPageShell'
import { buildTripStoryDraft } from '../../../../../lib/trip-story-draft'
import { useLogbookStore } from '../../../../../stores/logbook'

export const Route = createFileRoute('/_main/trips/$tripId/story/edit')({
  component: TripStoryEditPage,
  ssr: false,
})

function TripStoryEditPage() {
  const { tripId } = Route.useParams()
  const navigate = useNavigate()
  const editorGeneration = useRef(0)
  const htmlSeeded = useRef(false)
  const booted = useLogbookStore((state) => state.booted)
  const trip = useLogbookStore((state) =>
    state.trips.find((candidate) => candidate.id === tripId),
  )
  const entries = useLogbookStore((state) => state.entries)
  const media = useLogbookStore((state) => state.media)
  const tracks = useLogbookStore((state) => state.tracks)
  const updateTrip = useLogbookStore((state) => state.updateTrip)

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  const initialHtml = useMemo(() => {
    if (!trip) return ''
    if (trip.storyHtml?.trim()) return trip.storyHtml
    return buildTripStoryDraft({
      trip,
      entries: entries.filter((entry) => entry.tripId === tripId),
      mediaByEntry: groupMediaByEntry(
        media,
        entries.filter((entry) => entry.tripId === tripId),
      ),
      tracks: tracks.filter((track) => track.tripId === tripId),
    })
  }, [trip, entries, media, tracks, tripId])

  const [html, setHtml] = useState('')
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    if (!trip || htmlSeeded.current) return
    htmlSeeded.current = true
    setHtml(initialHtml)
  }, [trip, initialHtml])

  if (!booted) {
    return (
      <TripStoryPageShell>
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading trip…</p>
        </div>
      </TripStoryPageShell>
    )
  }

  if (!trip) {
    return (
      <TripStoryPageShell>
        <div className="mx-auto max-w-lg px-4 py-12">
          <p className="text-sm text-[var(--sea-ink-soft)]">Trip not found.</p>
          <Link
            to="/trips"
            className="mt-4 inline-block text-sm text-[var(--brand)]"
          >
            Back to trips
          </Link>
        </div>
      </TripStoryPageShell>
    )
  }

  const buildDraft = () =>
    buildTripStoryDraft({
      trip,
      entries: entries.filter((entry) => entry.tripId === tripId),
      mediaByEntry: groupMediaByEntry(
        media,
        entries.filter((entry) => entry.tripId === tripId),
      ),
      tracks: tracks.filter((track) => track.tripId === tripId),
    })

  const handleSave = async (nextHtml: string) => {
    await updateTrip(tripId, {
      storyHtml: nextHtml.trim() || null,
      storyUpdatedAt: new Date().toISOString(),
    })
    await navigate({ to: '/trips/$tripId/story', params: { tripId } })
  }

  const handleResetFromTrip = () => {
    editorGeneration.current += 1
    const draft = buildDraft()
    setHtml(draft)
    setEditorKey(editorGeneration.current)
  }

  return (
    <TripStoryEditor
      key={editorKey}
      tripId={tripId}
      html={html}
      onChange={setHtml}
      onSave={handleSave}
      onResetFromTrip={handleResetFromTrip}
      onCancel={() =>
        navigate({ to: '/trips/$tripId/story', params: { tripId } })
      }
    />
  )
}

function groupMediaByEntry(media: Media[], entries: Array<{ id: string }>) {
  const entryIds = new Set(entries.map((entry) => entry.id))
  const map = new Map<string, Media[]>()
  for (const item of media) {
    if (!entryIds.has(item.logEntryId)) continue
    const bucket = map.get(item.logEntryId) ?? []
    bucket.push(item)
    map.set(item.logEntryId, bucket)
  }
  return map
}
