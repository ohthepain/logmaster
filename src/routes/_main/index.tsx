import { createFileRoute } from '@tanstack/react-router'
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Edit3,
  FileText,
  ImagePlus,
  Mic,
  Plus,
  Sailboat,
  Send,
  Trash2,
  Waves,
} from 'lucide-react'
import {
  type ComponentType,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  LOG_ENTRY_TYPES,
  entryIcon,
  entryTitle,
  type LogEntry,
  type LogEntryType,
  type Media,
  type WeatherSnapshot,
  type Trip,
} from '../../domain/logbook'
import { cn } from '../../lib/cn'
import { useLogbookStore } from '../../stores/logbook'

export const Route = createFileRoute('/_main/')({
  component: LogbookHome,
})

function LogbookHome() {
  const store = useLogbookStore()
  const [startOpen, setStartOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<LogEntryType>('NOTE')
  const [startForm, setStartForm] = useState({
    boatName: '',
    registration: '',
    skipper: '',
  })
  const [draftNote, setDraftNote] = useState('')
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTrip =
    store.trips.find((trip) => trip.id === store.selectedTripId) ??
    store.trips[0] ??
    null
  const selectedTripEntries = useMemo(
    () =>
      selectedTrip
        ? store.entries.filter((entry) => entry.tripId === selectedTrip.id && !entry.deleted)
        : [],
    [selectedTrip, store.entries],
  )
  const selectedTripMedia = useMemo(() => {
    const mediaByEntry = new Map<string, Media[]>()
    for (const media of store.media) {
      const existing = mediaByEntry.get(media.logEntryId) ?? []
      existing.push(media)
      mediaByEntry.set(media.logEntryId, existing)
    }
    return mediaByEntry
  }, [store.media])
  const activeTrip = store.trips.find((trip) => trip.status === 'IN_PROGRESS') ?? null

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    const syncOnline = () => useLogbookStore.getState().setOnline(true)
    const syncOffline = () => useLogbookStore.getState().setOnline(false)
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOffline)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOffline)
    }
  }, [])

  useEffect(() => {
    if (store.booted && store.online) {
      void useLogbookStore.getState().syncNow()
    }
  }, [store.booted, store.online])

  useEffect(() => {
    if (selectedType !== 'PHOTO') {
      fileInputRef.current?.value && (fileInputRef.current.value = '')
    }
  }, [selectedType])

  const tripCount = store.trips.length
  const entryCount = store.entries.filter((entry) => !entry.deleted).length
  const unsyncedCount = store.entries.filter((entry) => !entry.synced && !entry.deleted).length

  const handleStartTrip = async (event: FormEvent) => {
    event.preventDefault()
    if (!startForm.boatName.trim()) {
      toast.error('Boat name is required')
      return
    }
    const trip = await store.startTrip(startForm)
    if (trip) {
      toast.success(`${trip.boatName} is now sailing`)
      setStartOpen(false)
      setStartForm({ boatName: '', registration: '', skipper: '' })
    }
  }

  const handleAddEntry = async () => {
    if (!selectedTrip) return
    const entry = await store.addEntry({
      tripId: selectedTrip.id,
      type: selectedType,
      notes: draftNote,
    })
    if (!entry) return
    toast.success('Saved locally')
    setComposerOpen(false)
    setDraftNote('')
    setSelectedType('NOTE')
  }

  const handleEventQuickAdd = async (type: LogEntryType) => {
    if (!selectedTrip) return
    await store.addEntry({ tripId: selectedTrip.id, type })
    toast.success(entryTitle(type))
  }

  const handlePhotoPick = async () => {
    if (!selectedTrip) return
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Choose a photo first')
      return
    }
    const entry = await store.addEntry({
      tripId: selectedTrip.id,
      type: 'PHOTO',
      notes: draftNote,
      data: { fileName: file.name, size: file.size, mimeType: file.type },
    })
    if (!entry) return
    await store.attachMedia(entry.id, {
      logEntryId: entry.id,
      type: 'photo',
      localPath: file.name,
      remoteUrl: null,
      thumbnailUrl: URL.createObjectURL(file),
    })
    toast.success('Photo saved locally')
    setComposerOpen(false)
    setDraftNote('')
  }

  const handleVoicePlaceholder = async () => {
    if (!selectedTrip) return
    await store.addEntry({
      tripId: selectedTrip.id,
      type: 'VOICE_NOTE',
      notes: draftNote || 'Voice note placeholder',
      data: { placeholder: true },
    })
    toast.success('Voice note placeholder saved locally')
    setComposerOpen(false)
    setDraftNote('')
  }

  const openEdit = (entry: LogEntry) => {
    setEditingEntryId(entry.id)
    setEditingNote(entry.notes ?? '')
  }

  const saveEdit = async () => {
    if (!editingEntryId) return
    await store.updateEntry(editingEntryId, { notes: editingNote })
    setEditingEntryId(null)
    setEditingNote('')
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(82,199,196,0.2),transparent_30%),linear-gradient(180deg,rgba(6,19,27,0.98),rgba(8,25,34,0.96))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-7">
        <div className="absolute right-0 top-0 size-56 -translate-y-1/2 translate-x-1/3 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-0 bottom-0 size-56 -translate-x-1/3 translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className="island-kicker text-[var(--lagoon-deep)]">Offline-first sail logbook</p>
            <h1 className="display-title max-w-2xl text-4xl font-bold leading-[0.98] text-[var(--foam)] sm:text-6xl">
              Log every turn, tack, and anchorage before the tide changes.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[rgba(232,246,244,0.78)] sm:text-base">
              Save locally first, sync later, and keep working if the connection
              disappears offshore.
            </p>
            <div className="flex flex-wrap gap-2">
              <StatPill label="Trips" value={tripCount} />
              <StatPill label="Entries" value={entryCount} />
              <StatPill label="Unsynced" value={unsyncedCount} muted={!unsyncedCount} />
              <StatPill label="Sync" value={store.syncMessage ?? (store.online ? 'Ready' : 'Offline')} wide />
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/8 bg-white/5 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setStartOpen(true)}
              className="flex items-center justify-between rounded-2xl bg-[linear-gradient(145deg,rgba(78,183,188,0.95),rgba(29,128,148,0.95))] px-4 py-4 text-left text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:translate-y-[-1px]"
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-slate-900/70">
                  No trip in progress?
                </span>
                <span className="mt-1 block text-lg font-bold">Start Sailing</span>
              </span>
              <ChevronRight className="size-6" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="Log Entry" icon={Plus} onClick={() => setComposerOpen(true)} />
              <QuickAction
                label="Event"
                icon={Waves}
                onClick={() => {
                  setSelectedType('SAILS_UP')
                  setComposerOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <div className="space-y-4">
          <PanelTitle
            kicker="Trips"
            title={activeTrip ? 'Trip in progress' : 'All trips'}
            subtitle="Tap a trip to review the timeline and clean up notes after the sail."
          />

          {store.trips.length === 0 ? (
            <EmptyState
              title="No trips yet"
              description="Start a sailing session to create the first trip and begin logging locally."
              actionLabel="Start Sailing"
              onAction={() => setStartOpen(true)}
              icon={Sailboat}
            />
          ) : (
            <div className="space-y-3">
              {store.trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  entryCount={store.entries.filter((entry) => entry.tripId === trip.id && !entry.deleted).length}
                  active={trip.id === selectedTrip?.id}
                  onSelect={() => store.selectTrip(trip.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <PanelTitle
            kicker={selectedTrip?.status === 'COMPLETED' ? 'Completed trip' : selectedTrip ? 'Timeline' : 'Timeline'}
            title={selectedTrip?.boatName ?? 'Select a trip'}
            subtitle={
              selectedTrip
                ? `${selectedTrip.status.replace('_', ' ').toLowerCase()} • ${selectedTripEntries.length} entries`
                : 'Pick a trip from the left to view the logbook timeline.'
            }
          />

          {selectedTrip ? (
            <>
              <div className="grid gap-3 rounded-[1.5rem] border border-white/5 bg-white/5 p-4">
                <TripDetail trip={selectedTrip} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('NOTE')
                      setComposerOpen(true)
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon)] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px]"
                  >
                    <FileText className="size-4" />
                    Log Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foam)] transition hover:bg-[var(--link-bg-hover)]"
                  >
                    <Send className="size-4" />
                    Event
                  </button>
                  {selectedTrip.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => handleEventQuickAdd('END_TRIP')}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15"
                    >
                      <Check className="size-4" />
                      End Trip
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {selectedTripEntries.length === 0 ? (
                  <EmptyState
                    title="No log entries yet"
                    description="Add the first note or event to start the timeline."
                    actionLabel="Log Entry"
                    onAction={() => setComposerOpen(true)}
                    icon={Anchor}
                    compact
                  />
                ) : (
                  selectedTripEntries.map((entry, index) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      media={selectedTripMedia.get(entry.id) ?? []}
                      first={index === 0}
                      last={index === selectedTripEntries.length - 1}
                      onEdit={() => openEdit(entry)}
                      onDelete={() => void store.deleteEntry(entry.id)}
                      onMoveUp={() => void store.nudgeEntryTime(entry.id, -5)}
                      onMoveDown={() => void store.nudgeEntryTime(entry.id, 5)}
                      editing={editingEntryId === entry.id}
                      editingNote={editingNote}
                      onEditingNoteChange={setEditingNote}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => {
                        setEditingEntryId(null)
                        setEditingNote('')
                      }}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Choose a trip"
              description="The timeline lives here. Start a sailing session to see log entries appear immediately."
              actionLabel="Start Sailing"
              onAction={() => setStartOpen(true)}
              icon={Waves}
            />
          )}
        </div>
      </section>

      {store.booted && !store.online && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 shadow-xl backdrop-blur">
          Offline mode active. Saves stay local until the connection returns.
        </div>
      )}

      {composerOpen && selectedTrip && (
        <Modal title="Log Entry" onClose={() => setComposerOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOG_ENTRY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition',
                    selectedType === type
                      ? 'border-[var(--lagoon)] bg-[var(--lagoon)]/15 text-[var(--foam)]'
                      : 'border-[var(--line)] bg-[var(--chip-bg)] text-[var(--foam)] hover:bg-[var(--link-bg-hover)]',
                  )}
                >
                  <span className="block text-lg">{entryIcon(type)}</span>
                  <span className="mt-1 block">{entryTitle(type)}</span>
                </button>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foam)]">Note</span>
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={4}
                placeholder="Short note, observation, or reminder"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--foam)] placeholder:text-[rgba(232,246,244,0.45)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
              />
            </label>

            {selectedType === 'PHOTO' && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="block w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--foam)]"
                />
                <p className="m-0 text-xs leading-6 text-[rgba(232,246,244,0.72)]">
                  Photos are stored locally in the Media table for later sync and thumbnail handling.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleAddEntry()}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon)] px-4 py-2.5 text-sm font-semibold text-slate-950"
              >
                <Check className="size-4" />
                Save locally
              </button>
              {selectedType === 'PHOTO' && (
                <button
                  type="button"
                  onClick={() => void handlePhotoPick()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foam)]"
                >
                  <ImagePlus className="size-4" />
                  Save photo
                </button>
              )}
              {selectedType === 'VOICE_NOTE' && (
                <button
                  type="button"
                  onClick={() => void handleVoicePlaceholder()}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foam)]"
                >
                  <Mic className="size-4" />
                  Save voice placeholder
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {startOpen && (
        <Modal title="Start Sailing" onClose={() => setStartOpen(false)}>
          <form className="space-y-4" onSubmit={(e) => void handleStartTrip(e)}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foam)]">Boat name</span>
              <input
                value={startForm.boatName}
                onChange={(e) => setStartForm((current) => ({ ...current, boatName: e.target.value }))}
                placeholder="S/V North Star"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--foam)] placeholder:text-[rgba(232,246,244,0.45)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foam)]">Registration</span>
              <input
                value={startForm.registration}
                onChange={(e) => setStartForm((current) => ({ ...current, registration: e.target.value }))}
                placeholder="Optional registration"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--foam)] placeholder:text-[rgba(232,246,244,0.45)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--foam)]">Skipper</span>
              <input
                value={startForm.skipper}
                onChange={(e) => setStartForm((current) => ({ ...current, skipper: e.target.value }))}
                placeholder="Optional skipper"
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--foam)] placeholder:text-[rgba(232,246,244,0.45)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
              />
            </label>

            <p className="m-0 text-xs leading-6 text-[rgba(232,246,244,0.72)]">
              Location, timestamp, weather, and country are captured automatically when the trip starts.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--lagoon)] px-4 py-2.5 text-sm font-semibold text-slate-950"
              >
                <Sailboat className="size-4" />
                Create trip
              </button>
              <button
                type="button"
                onClick={() => setStartOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foam)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  )
}

function StatPill({
  label,
  value,
  muted,
  wide,
}: {
  label: string
  value: number | string
  muted?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/8 bg-white/6 px-3 py-2.5 text-white/90',
        wide && 'min-w-[11rem] sm:min-w-[13rem]',
      )}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">
        {label}
      </p>
      <p className={cn('m-0 mt-1 text-sm font-semibold', muted && 'text-white/60')}>
        {value}
      </p>
    </div>
  )
}

function PanelTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string
  title: string
  subtitle: string
}) {
  return (
    <div className="space-y-1">
      <p className="island-kicker text-[var(--kicker)]">{kicker}</p>
      <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--foam)]">{title}</h2>
      <p className="m-0 max-w-2xl text-sm leading-7 text-[rgba(232,246,244,0.72)]">
        {subtitle}
      </p>
    </div>
  )
}

function TripCard({
  trip,
  entryCount,
  active,
  onSelect,
}: {
  trip: Trip
  entryCount: number
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-[1px]',
        active
          ? 'border-[rgba(82,199,196,0.45)] bg-[rgba(82,199,196,0.12)] shadow-lg shadow-cyan-950/10'
          : 'border-white/8 bg-white/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
            {trip.status.replace('_', ' ')}
          </p>
          <h3 className="m-0 mt-1 truncate text-lg font-bold text-[var(--foam)]">
            {trip.boatName}
          </h3>
          <p className="m-0 mt-1 text-sm text-[rgba(232,246,244,0.68)]">
            {formatDateTime(trip.startedAt)}
            {trip.completedAt ? ` · completed ${formatDateTime(trip.completedAt)}` : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-white/6 px-3 py-2 text-right">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
            Entries
          </p>
          <p className="m-0 text-xl font-bold text-white">{entryCount}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[rgba(232,246,244,0.72)]">
        {trip.startCountry && <Badge>{trip.startCountry}</Badge>}
        {trip.registration && <Badge>{trip.registration}</Badge>}
        {trip.skipper && <Badge>{trip.skipper}</Badge>}
      </div>
    </button>
  )
}

function TripDetail({ trip }: { trip: Trip }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <DetailLine label="Started" value={formatDateTime(trip.startedAt)} />
      <DetailLine label="Status" value={trip.status.replace('_', ' ')} />
      <DetailLine label="Position" value={formatPosition(trip.startLatitude, trip.startLongitude)} />
      <DetailLine label="Country" value={trip.startCountry ?? 'Unknown'} />
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/45">
        {label}
      </p>
      <p className="m-0 mt-1 text-sm font-medium text-[var(--foam)]">{value}</p>
    </div>
  )
}

function EntryCard({
  entry,
  media,
  first,
  last,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  editing,
  editingNote,
  onEditingNoteChange,
  onSaveEdit,
  onCancelEdit,
}: {
  entry: LogEntry
  media: Media[]
  first: boolean
  last: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  editing: boolean
  editingNote: string
  onEditingNoteChange: (next: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}) {
  return (
    <article
      className={cn(
        'rounded-[1.5rem] border p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]',
        entry.deleted
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-white/8 bg-[linear-gradient(180deg,rgba(11,31,41,0.92),rgba(10,24,33,0.96))]',
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--lagoon)]/14 text-xl">
          {entryIcon(entry.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-[var(--foam)]">{entryTitle(entry.type)}</p>
              <p className="m-0 mt-1 text-xs text-[rgba(232,246,244,0.66)]">
                {formatDateTime(entry.timestamp)}
                {entry.accuracy != null ? ` · ±${Math.round(entry.accuracy)}m` : ''}
              </p>
            </div>
            <SyncBadge synced={entry.synced} deleted={entry.deleted} />
          </div>

          <div className="mt-2 space-y-2 text-sm text-[rgba(232,246,244,0.82)]">
            <p className="m-0">{formatPosition(entry.latitude, entry.longitude)}</p>
            {entry.heading != null && <p className="m-0">Heading {Math.round(entry.heading)}°</p>}
            {entry.notes && !editing && <p className="m-0">{entry.notes}</p>}
            {entry.weather && (
              <p className="m-0 text-xs text-[rgba(232,246,244,0.66)]">
                Weather: {formatWeather(entry.weather)}
              </p>
            )}
            {media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {media.map((item) => (
                  <Badge key={item.id}>
                    {item.type}
                    {item.localPath ? ` · ${item.localPath}` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editingNote}
                onChange={(e) => onEditingNoteChange(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--foam)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="rounded-full bg-[var(--lagoon)] px-3 py-2 text-xs font-semibold text-slate-950"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-xs font-semibold text-[var(--foam)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <IconButton icon={Edit3} label="Edit" onClick={onEdit} />
              <IconButton icon={ArrowUp} label="Earlier" onClick={onMoveUp} disabled={first} />
              <IconButton icon={ArrowDown} label="Later" onClick={onMoveDown} disabled={last} />
              <IconButton icon={Trash2} label="Delete" onClick={onDelete} danger />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition',
        danger
          ? 'border-red-500/25 bg-red-500/10 text-red-100 hover:bg-red-500/15'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--foam)] hover:bg-[var(--link-bg-hover)]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-4 text-left text-[var(--foam)] transition hover:bg-white/10"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  compact,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  icon: ComponentType<{ className?: string }>
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] border border-white/8 bg-white/5 p-5 text-center',
        compact && 'p-4',
      )}
    >
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--lagoon)]/12 text-[var(--foam)]">
        <Icon className="size-5" />
      </div>
      <h3 className="m-0 text-lg font-bold text-[var(--foam)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[rgba(232,246,244,0.72)]">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--lagoon)] px-4 py-2.5 text-sm font-semibold text-slate-950"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,25,34,0.98),rgba(7,19,26,0.98))] p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="island-kicker text-[var(--kicker)]">logmaster</p>
            <h3 className="m-0 text-xl font-bold text-[var(--foam)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--foam)]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SyncBadge({ synced, deleted }: { synced: boolean; deleted: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]',
        deleted
          ? 'bg-red-500/10 text-red-100'
          : synced
            ? 'bg-emerald-400/10 text-emerald-100'
            : 'bg-amber-400/10 text-amber-50',
      )}
    >
      {deleted ? 'Deleted' : synced ? 'Synced' : 'Saved locally'}
    </span>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-white/6 px-2.5 py-1 text-xs font-medium text-[rgba(232,246,244,0.8)]">
      {children}
    </span>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatPosition(latitude?: number | null, longitude?: number | null) {
  if (latitude == null || longitude == null) return 'Position unavailable'
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function formatWeather(weather: WeatherSnapshot) {
  const parts: string[] = []
  if (typeof weather.temperatureC === 'number') {
    parts.push(`${Math.round(weather.temperatureC)}°C`)
  }
  if (typeof weather.windKph === 'number') {
    parts.push(`${Math.round(weather.windKph)} km/h wind`)
  }
  if (typeof weather.cloudCoverPct === 'number') {
    parts.push(`${Math.round(weather.cloudCoverPct)}% cloud`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Weather available'
}
